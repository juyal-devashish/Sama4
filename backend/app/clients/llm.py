"""Claude (Anthropic API) client: the only place the app talks to an LLM."""

import functools
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Literal, ParamSpec, TypeVar

from app.clients.usage import DailyBudgetExceeded, UsageMeter, seconds_until_utc_midnight

logger = logging.getLogger(__name__)

Effort = Literal["low", "medium", "high", "xhigh", "max"]

# Opus 5.5 thinks before answering, and thinking tokens count toward max_tokens.
# Keep a generous ceiling so short answers are never cut off mid-thought.
# Output length is controlled by the prompts, not by this cap.
MIN_MAX_TOKENS = 8000

# Server-side refusal fallback: on a policy decline the API re-runs the request
# on a suitable fallback model inside the same call. Only some models accept it
# (Haiku 5.5 does not, and sending it there returns a 400).
FALLBACK_BETA = "server-side-fallback-2026-07-01"
FALLBACK_MODELS = frozenset(
    {"claude-fable-5-1", "claude-fable-5", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"}
)


def supports_server_fallback(model: str) -> bool:
    return model in FALLBACK_MODELS


# Set while a background batch (nightly ingestion, a re-summarize) runs: those calls are
# counted but never blocked by the daily cap, because their volume is bounded elsewhere.
_batch_mode: ContextVar[bool] = ContextVar("llm_batch_mode", default=False)


@contextmanager
def batch_calls() -> Iterator[None]:
    """Exempt Claude calls made inside this block from the daily cap."""
    token = _batch_mode.set(True)
    try:
        yield
    finally:
        _batch_mode.reset(token)


P = ParamSpec("P")
R = TypeVar("R")


def batch_job(fn: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
    """Decorator: run a background job with `batch_calls()` active."""

    @functools.wraps(fn)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        with batch_calls():
            return await fn(*args, **kwargs)

    return wrapper


@dataclass
class StreamEnd:
    """The last item `LLMClient.stream` yields: the whole text, as `generate` would return."""

    text: str  # "" if Claude declined


UNAVAILABLE_TEXT = "(LLM unavailable — set ANTHROPIC_API_KEY to enable context generation)"


class LLMClient:
    """Thin async wrapper around the Anthropic Messages API."""

    def __init__(
        self,
        api_key: str,
        model: str,
        default_effort: Effort = "low",
        meter: UsageMeter | None = None,
    ) -> None:
        self.model = model
        self.default_effort = default_effort
        self.meter = meter
        self._client = None
        if api_key:
            from anthropic import AsyncAnthropic

            self._client = AsyncAnthropic(api_key=api_key)
        else:
            logger.warning("ANTHROPIC_API_KEY not set, LLM features disabled")

    @property
    def available(self) -> bool:
        """True when an API key is configured."""
        return self._client is not None

    async def over_budget(self) -> bool:
        """True when reader-facing calls are paused for today."""
        return bool(self.meter and not _batch_mode.get() and await self.meter.exceeded())

    async def generate(
        self,
        prompt: str,
        *,
        effort: Effort | None = None,
        system: str | None = None,
        max_tokens: int = MIN_MAX_TOKENS,
    ) -> str:
        """Generate a completion from Claude.

        Args:
            prompt: The user prompt.
            effort: Thinking depth; defaults to the client's default_effort.
            system: Optional system prompt.
            max_tokens: Output ceiling (thinking + answer), raised to MIN_MAX_TOKENS.

        Returns:
            The generated text, "" if Claude declined, or UNAVAILABLE_TEXT when no key is set.

        Raises:
            anthropic.APIStatusError / APIConnectionError on API failures.
            DailyBudgetExceeded when today's token cap is used up (not raised inside
            `batch_calls()`).
        """
        if self._client is None:
            return UNAVAILABLE_TEXT
        if await self.over_budget():
            raise DailyBudgetExceeded(seconds_until_utc_midnight())

        import anthropic

        kwargs = self._request(prompt, effort, system, max_tokens)

        try:
            if supports_server_fallback(self.model):
                response = await self._client.beta.messages.create(
                    **kwargs, betas=[FALLBACK_BETA], fallbacks="default"
                )
            else:
                response = await self._client.messages.create(**kwargs)
        except anthropic.RateLimitError:
            logger.warning("Claude rate limited")
            raise
        except anthropic.APIStatusError as e:
            logger.error("Claude API error %s: %s", e.status_code, e.message)
            raise
        except anthropic.APIConnectionError:
            logger.error("Could not reach the Claude API")
            raise

        await self._record_usage(response)
        if self._declined(response):
            return ""
        return "".join(b.text for b in response.content if b.type == "text").strip()

    def _request(
        self, prompt: str, effort: Effort | None, system: str | None, max_tokens: int
    ) -> dict:
        kwargs: dict = {
            "model": self.model,
            "max_tokens": max(max_tokens, MIN_MAX_TOKENS),
            "output_config": {"effort": effort or self.default_effort},
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            kwargs["system"] = system
        return kwargs

    async def _record_usage(self, response) -> None:
        """Count a finished call's tokens toward the daily cap."""
        if self.meter is None:
            return
        usage = response.usage
        await self.meter.record(
            sum(
                getattr(usage, f, 0) or 0
                for f in (
                    "input_tokens",
                    "output_tokens",
                    "cache_creation_input_tokens",
                    "cache_read_input_tokens",
                )
            )
        )

    @staticmethod
    def _declined(response) -> bool:
        if response.stop_reason == "refusal":
            category = response.stop_details.category if response.stop_details else None
            logger.warning("Claude declined the request (category=%s)", category)
            return True
        if response.stop_reason == "max_tokens":
            logger.warning("Claude response hit max_tokens; output may be truncated")
        return False

    async def stream(
        self,
        prompt: str,
        *,
        effort: Effort | None = None,
        system: str | None = None,
        max_tokens: int = MIN_MAX_TOKENS,
    ) -> AsyncIterator[str | StreamEnd]:
        """Like `generate`, but yields the text as it is written, then a `StreamEnd`.

        Same rules as `generate`: nothing is sent once today's token cap is used up
        (`DailyBudgetExceeded`, before the first item), tokens are counted from the final
        message, and a refusal ends with `StreamEnd("")`. Logs the seconds until the first
        text arrives (it includes Claude's thinking time).
        """
        if self._client is None:
            yield StreamEnd(UNAVAILABLE_TEXT)
            return
        if await self.over_budget():
            raise DailyBudgetExceeded(seconds_until_utc_midnight())

        import anthropic

        kwargs = self._request(prompt, effort, system, max_tokens)
        started = time.monotonic()
        first_token_at: float | None = None
        parts: list[str] = []
        try:
            if supports_server_fallback(self.model):
                manager = self._client.beta.messages.stream(
                    **kwargs, betas=[FALLBACK_BETA], fallbacks="default"
                )
            else:
                manager = self._client.messages.stream(**kwargs)
            async with manager as stream:
                async for text in stream.text_stream:
                    if first_token_at is None:
                        first_token_at = time.monotonic() - started
                        logger.info(
                            "Claude first token after %.2fs (model=%s, effort=%s)",
                            first_token_at,
                            self.model,
                            effort or self.default_effort,
                        )
                    parts.append(text)
                    yield text
                final = await stream.get_final_message()
        except anthropic.RateLimitError:
            logger.warning("Claude rate limited")
            raise
        except anthropic.APIStatusError as e:
            logger.error("Claude API error %s: %s", e.status_code, e.message)
            raise
        except anthropic.APIConnectionError:
            logger.error("Could not reach the Claude API")
            raise

        await self._record_usage(final)
        logger.info("Claude stream finished in %.2fs", time.monotonic() - started)
        yield StreamEnd("" if self._declined(final) else "".join(parts).strip())

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.close()
