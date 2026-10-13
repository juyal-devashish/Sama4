import logging

from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)

SUMMARY_PROMPT = """Summarize the following news article in 2-3 sentences. \
Focus on the key facts and main point of the article.

ARTICLE:
{article_text}

SUMMARY:"""


class SummarizerService:
    """Generates article summaries using GPT-4o-mini."""

    def __init__(self) -> None:
        self.llm = LLMService()

    async def summarize(self, article_text: str) -> str:
        """Generate a 2-3 sentence summary of an article.

        Args:
            article_text: The cleaned article text.

        Returns:
            Summary string.
        """
        # Truncate to ~3000 words to stay within token limits
        words = article_text.split()
        truncated = " ".join(words[:3000])

        prompt = SUMMARY_PROMPT.format(article_text=truncated)

        return await self.llm.generate(
            prompt,
            model="gpt-4o-mini",
            max_tokens=200,
            temperature=0.3,
        )
