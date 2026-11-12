import logging

from app.config import settings
from app.services.cache_service import CacheService

logger = logging.getLogger(__name__)

# Opus 5.5 thinks before answering, and thinking tokens count toward max_tokens.
# Keep a generous ceiling so short answers are never cut off mid-thought.
# Output length is controlled by the prompts, not by this cap.
MIN_MAX_TOKENS = 8000

# Server-side refusal fallback: on a policy decline the API re-runs the request
# on a suitable fallback model inside the same call.
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class LLMService:
    """Claude interface for summaries, entity context, follow-ups and predictions."""

    def __init__(self) -> None:
        self.client = None
        if settings.anthropic_api_key:
            from anthropic import AsyncAnthropic

            self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        else:
            logger.warning("ANTHROPIC_API_KEY not set, LLM features disabled")
        self.cache = CacheService()

    async def generate(
        self,
        prompt: str,
        max_tokens: int = MIN_MAX_TOKENS,
        effort: str | None = None,
        system: str | None = None,
    ) -> str:
        """Generate a completion from Claude.

        Args:
            prompt: The user prompt to send.
            max_tokens: Output ceiling (thinking + answer). Raised to MIN_MAX_TOKENS.
            effort: "low" | "medium" | "high" | "xhigh" | "max". Defaults to
                settings.anthropic_effort.
            system: Optional system prompt.

        Returns:
            The generated text, or "" if Claude declined.
        """
        if not self.client:
            return "(LLM unavailable — set ANTHROPIC_API_KEY to enable context generation)"

        import anthropic

        kwargs: dict = {
            "model": settings.anthropic_model,
            "max_tokens": max(max_tokens, MIN_MAX_TOKENS),
            "output_config": {"effort": effort or settings.anthropic_effort},
            "messages": [{"role": "user", "content": prompt}],
            "betas": [FALLBACK_BETA],
            "fallbacks": "default",
        }
        if system:
            kwargs["system"] = system

        try:
            response = await self.client.beta.messages.create(**kwargs)
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

    async def generate_embedding(self, text: str, input_type: str = "query") -> list[float]:
        """Embed text for Pinecone. Claude has no embeddings API, so this uses
        Pinecone's hosted embedding model (see app/services/vectors.py).
        """
        from app.services.vectors import embed_texts

        vectors = await embed_texts([text], input_type=input_type)
        return vectors[0] if vectors and vectors[0] is not None else []
