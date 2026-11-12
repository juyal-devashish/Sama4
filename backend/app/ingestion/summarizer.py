import logging

from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM = """You write the summary shown on a news card in samā4, a news reader app. \
The input is the headline plus whatever text the publisher's RSS feed provided: sometimes the full article, \
often only a headline-length teaser or the first paragraph. Readers see only your output, \
and they know it is a short summary of a news report.

Write 1-3 plain sentences stating what the report says, attributing claims to the report \
where they are allegations ("the report says...", "according to the article..."). \
Use only facts present in the text. When the text is short, write a shorter summary \
instead of commenting on its length.

Output only the summary text, in plain prose with no markdown, headings, labels, notes \
to the reader, or requests for more information."""  # noqa: E501 (LLM prompt text)

SUMMARY_PROMPT = """<headline>{title}</headline>
<article>
{article_text}
</article>"""


class SummarizerService:
    """Generates article summaries using Claude."""

    def __init__(self) -> None:
        self.llm = LLMService()

    async def summarize(self, article_text: str, title: str = "") -> str:
        """Generate a 2-3 sentence summary of an article.

        Args:
            article_text: The cleaned article text.
            title: The article headline (helps when the feed gives only a teaser).

        Returns:
            Summary string.
        """
        # Truncate to ~3000 words to stay within token limits
        words = article_text.split()
        truncated = " ".join(words[:3000])

        prompt = SUMMARY_PROMPT.format(title=title, article_text=truncated)

        return await self.llm.generate(prompt, effort="low", system=SUMMARY_SYSTEM)
