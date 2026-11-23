import logging

from app.clients.llm import LLMClient
from app.text import sentence_ends

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
MIN_SOURCE_WORDS = 40  # shorter feed text is shown as it is; a brief would only paraphrase it
SOURCE_RATIO = 0.5  # a summary is at most half as long as the text it summarizes


def wants_brief(source_words: int) -> bool:
    """Whether a story whose feed text has `source_words` words gets a brief."""
    return source_words >= MIN_SOURCE_WORDS


def summary_word_limit(source_words: int) -> int:
    """How long a summary of `source_words` words may be.

    Half the source, between MIN and MAX words, and never longer than the source itself:
    a 300-word opening gets 60 words, an 80-word teaser 40, a 12-word teaser 12.
    """
    limit = max(MIN_SUMMARY_WORDS, min(MAX_SUMMARY_WORDS, int(source_words * SOURCE_RATIO)))
    return min(limit, source_words) if source_words > 0 else MIN_SUMMARY_WORDS


def whole_sentences(text: str, limit: int = MAX_SUMMARY_WORDS) -> str | None:
    """Trim `text` to whole sentences of at most `limit` words. Never cuts mid-sentence.

    If even the first sentence is over `limit`, it is kept whole as long as it fits in
    MAX_SUMMARY_WORDS; longer than that, there is no usable brief and this returns None.
    "U.S." and "Gov." are not sentence ends (see `app.text`).
    """
    text = text.strip()
    if not text:
        return None
    if len(text.split()) <= limit:
        return text
    ends = sentence_ends(text)
    fitting = [e for e in ends if len(text[:e].split()) <= limit]
    if fitting:
        return text[: fitting[-1]]
    if ends and len(text[: ends[0]].split()) <= MAX_SUMMARY_WORDS:
        return text[: ends[0]]
    return None


class SummarizerService:
    """Generates article summaries using Claude."""

    def __init__(self, llm: LLMClient) -> None:
        self.llm = llm

    async def summarize(self, article_text: str, title: str = "") -> str | None:
        """Generate a 2-3 sentence brief of a story, or None when it gets none.

        Args:
            article_text: The cleaned article text.
            title: The article headline (helps when the feed gives only a teaser).

        Returns:
            The brief, in whole sentences. None when the text is too short to need one
            (see `wants_brief`) or Claude's reply can't be trimmed to whole sentences.
        """
        # Truncate to ~3000 words to stay within token limits
        words = article_text.split()
        if not wants_brief(len(words)):
            return None
        truncated = " ".join(words[:3000])

        limit = summary_word_limit(len(words))
        prompt = SUMMARY_PROMPT.format(title=title, article_text=truncated, word_limit=limit)

        summary = await self.llm.generate(prompt, effort="low", system=SUMMARY_SYSTEM)
        return whole_sentences(summary, limit)
