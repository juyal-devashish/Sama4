import logging
import re

from app.clients.llm import LLMClient

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM = """You write the summary shown on a news card in Samā4, a news reader app. \
The input is the headline plus the publisher's own text: usually the short description from \
its feed, sometimes the opening of the article where the publisher allows it. Readers see only your output, \
and they know it is a short summary of a news report.

Write 2-3 plain sentences, no more than the word limit given: first what happened, then why it matters. Say why it matters \
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
</article>
<word_limit>{word_limit}</word_limit>"""


MAX_SUMMARY_WORDS = 60
MIN_SUMMARY_WORDS = 15
SOURCE_RATIO = 0.5  # a summary is at most half as long as the text it summarizes


def summary_word_limit(source_words: int) -> int:
    """How long a summary of `source_words` words may be.

    Half the source, between MIN and MAX words, and never longer than the source itself:
    a 300-word opening gets 60 words, an 80-word teaser 40, a 12-word teaser 12.
    """
    limit = max(MIN_SUMMARY_WORDS, min(MAX_SUMMARY_WORDS, int(source_words * SOURCE_RATIO)))
    return min(limit, source_words) if source_words > 0 else MIN_SUMMARY_WORDS


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

        limit = summary_word_limit(len(words))
        prompt = SUMMARY_PROMPT.format(title=title, article_text=truncated, word_limit=limit)

        summary = await self.llm.generate(prompt, effort="low", system=SUMMARY_SYSTEM)
        return cap_words(summary, limit)
