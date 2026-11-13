import logging
import re

from app.clients.llm import LLMClient

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM = """You write the summary shown on a news card in Samā4, a news reader app. \
The input is the headline plus the opening of the publisher's article (up to about 300 words), \
or only a short teaser when the page could not be read. Readers see only your output, \
and they know it is a short summary of a news report.

Write 2-3 plain sentences, 60 words at most: first what happened, then why it matters. Say why it matters \
only when the text states or plainly shows the consequence (who is affected, what changes, \
what comes next); never supply a significance the text doesn't support. Attribute claims \
to the report where they are allegations ("the report says...", "according to the \
article..."). Use only facts present in the text. When the text is short, write a \
shorter summary instead of commenting on its length.

Output only the summary text, in plain prose with no markdown, headings, labels, notes \
to the reader, or requests for more information."""  # noqa: E501 (LLM prompt text)

SUMMARY_PROMPT = """<headline>{title}</headline>
<article>
{article_text}
</article>"""


MAX_SUMMARY_WORDS = 60
_SENTENCE_END = re.compile(r"[.!?][\"'”’)]?(?=\s|$)")


def cap_words(text: str, limit: int = MAX_SUMMARY_WORDS) -> str:
    """Trim to `limit` words, ending on a whole sentence when one fits."""
    words = text.split()
    if len(words) <= limit:
        return text.strip()
    cut = " ".join(words[:limit])
    ends = list(_SENTENCE_END.finditer(cut))
    return cut[: ends[-1].end()] if ends else cut.rstrip(",;:") + "…"


class SummarizerService:
    """Generates article summaries using Claude."""

    def __init__(self, llm: LLMClient) -> None:
        self.llm = llm

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

        return cap_words(await self.llm.generate(prompt, effort="low", system=SUMMARY_SYSTEM))
