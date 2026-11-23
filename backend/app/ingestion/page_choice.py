"""Choose the Wikipedia page a highlighted term means in its story.

Wikidata ranks search hits by popularity, not by the story: "ICE" is first a German
train, "EU" the Basque language, "deal" a town in Kent. So the linker asks Wikidata for
several candidates and Claude picks the one the story means, or none of them.
"""

import json
import logging
from dataclasses import dataclass

from app.clients.llm import LLMClient
from app.clients.usage import DailyBudgetExceeded
from app.clients.wikimedia import WikidataCandidate

logger = logging.getLogger(__name__)

BATCH = 25  # terms per Claude call
CONTEXT_RADIUS = 160  # characters of story text kept on each side of a term

SYSTEM = """You link terms highlighted in news stories to the Wikidata item they refer to. \
For each term you get the headline, the passage it appears in, and numbered Wikidata \
search results. Pick the result that is the thing the passage means. Choose null when no \
result fits: a band, film, album, family name or place that merely shares the word is \
never the answer for a common noun or an agency. Reply with JSON only."""


@dataclass
class TermToLink:
    key: str  # unique within one call; echoed back in the answer
    text: str
    type: str
    headline: str
    context: str
    candidates: list[WikidataCandidate]


def passage_around(content: str, start: int, end: int, radius: int = CONTEXT_RADIUS) -> str:
    """The story text around [start, end), trimmed to whole words."""
    if not content:
        return ""
    lo, hi = max(0, start - radius), min(len(content), end + radius)
    passage = content[lo:hi]
    if lo > 0:
        passage = passage.split(" ", 1)[-1]
    if hi < len(content):
        passage = passage.rsplit(" ", 1)[0]
    return passage.strip()


def _prompt(batch: list[TermToLink]) -> str:
    blocks = []
    for t in batch:
        options = "\n".join(
            f"  {c.id}: {c.label}" + (f" ({c.description})" if c.description else "")
            for c in t.candidates
        )
        blocks.append(
            f'<term key="{t.key}" text="{t.text}" type="{t.type}">\n'
            f"<headline>{t.headline}</headline>\n<passage>{t.context}</passage>\n"
            f"<results>\n{options}\n</results>\n</term>"
        )
    return (
        "\n\n".join(blocks)
        + "\n\nReturn one JSON object mapping each term key to the chosen id or null, e.g. "
        '{"t1": "Q458", "t2": null}.'
    )


def _parse(raw: str, batch: list[TermToLink]) -> dict[str, str | None]:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0]
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    answers: dict[str, str | None] = {}
    for t in batch:
        if t.key not in parsed:
            continue
        choice = parsed[t.key]
        allowed = {c.id for c in t.candidates}
        if choice is None:
            answers[t.key] = None
        elif isinstance(choice, str) and choice in allowed:
            answers[t.key] = choice
        # an id that wasn't offered is no answer at all
    return answers


async def choose_pages(llm: LLMClient, terms: list[TermToLink]) -> dict[str, str | None]:
    """{key: chosen Wikidata id, or None when Claude says no result fits}.

    A term with no candidates is answered None without asking. A key missing from the
    result means there is no answer (Claude unavailable, over budget, or an unreadable
    reply): callers must not treat that as "none fits".
    """
    answers: dict[str, str | None] = {t.key: None for t in terms if not t.candidates}
    todo = [t for t in terms if t.candidates]
    if not todo or not llm.available:
        return answers
    for i in range(0, len(todo), BATCH):
        batch = todo[i : i + BATCH]
        try:
            raw = await llm.generate(_prompt(batch), effort="low", system=SYSTEM)
        except DailyBudgetExceeded:
            logger.warning("Over today's Claude budget; %d terms left unlinked", len(todo) - i)
            break
        found = _parse(raw, batch)
        if len(found) < len(batch):
            logger.warning(
                "Page choice: %d of %d terms unanswered", len(batch) - len(found), len(batch)
            )
        answers.update(found)
    return answers
