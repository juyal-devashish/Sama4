"""Claude (Anthropic API) client: the only place the app talks to an LLM."""

import logging
from typing import Literal

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


UNAVAILABLE_TEXT = "(LLM unavailable — set ANTHROPIC_API_KEY to enable context generation)"


class LLMClient:
    """Thin async wrapper around the Anthropic Messages API."""

    def __init__(self, api_key: str, model: str, default_effort: Effort = "low") -> None:
        self.model = model
        self.default_effort = default_effort
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
        """
        if self._client is None:
            return UNAVAILABLE_TEXT

        import anthropic

        kwargs: dict = {
            "model": self.model,
            "max_tokens": max(max_tokens, MIN_MAX_TOKENS),
            "output_config": {"effort": effort or self.default_effort},
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            kwargs["system"] = system

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

        if response.stop_reason == "refusal":
            category = response.stop_details.category if response.stop_details else None
            logger.warning("Claude declined the request (category=%s)", category)
            return ""
        if response.stop_reason == "max_tokens":
            logger.warning("Claude response hit max_tokens; output may be truncated")

        return "".join(b.text for b in response.content if b.type == "text").strip()

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.close()
