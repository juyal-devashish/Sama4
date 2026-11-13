"""Pick the day's stories: rank every fresh RSS candidate by real-world consequence.

Runs before the expensive steps (NER, linking, summaries, embeddings), so only the
stories that clear the bar cost Claude and Pinecone calls. The rules mirror a daily
briefing: 12-15 stories, consequence first, region only as a tie-break, one or two
well-reported stories from outside the usual beat, and no padding.
"""

import json
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime

from app.clients.llm import LLMClient
from app.ingestion.fetcher import FetchedArticle

logger = logging.getLogger(__name__)

TEASER_CHARS = 240

RANK_SYSTEM = """You are the front-page editor of samā4, a news reader. From a list of \
candidate stories published in the last 24 hours, choose today's edition.

How to choose:
- Rank candidates by real-world consequence: how many people are affected, how much, \
and for how long. Pick the top {target} stories regardless of category, and up to \
{maximum} when additional stories clearly clear the same bar.
- Region is only a tie-breaker between similarly consequential stories, in this order: \
USA, then India, then major world news, then tech/AI. There is no quota per category.
- In tech and AI, favor major developments, notable product or company launches, and \
industry or career trends over minor product news.
- Include one or two stories that fall entirely outside USA/India/world/tech, chosen \
because they are well reported and a reader would otherwise miss them. Mark them offbeat.
- Many outlets cover the same story. Treat those as one story: choose the candidate \
from the most primary or established newsroom (wire services and major newsrooms over \
aggregators), and list the others in "also".
- Judge only from the headlines and teasers given. Do not assume facts they don't state.
- If fewer than {target} stories clear the bar, return fewer and say so in "note" \
instead of padding with minor items.

Reply with only a JSON object, no prose and no code fences:
{{"stories": [{{"id": <candidate id>, "also": [<ids of other coverage>], \
"offbeat": <true|false>, "why": "<one short clause on the consequence>"}}], \
"note": "<empty, or why fewer than {target} stories were chosen>"}}
List stories from most to least consequential."""

RANK_PROMPT = """Now: {now}
Candidates ({count}):
{lines}"""


@dataclass
class Candidate:
    """A fresh RSS item that has not been stored yet, with the feed it came from."""

    fetched: FetchedArticle
    source: dict


@dataclass
class Pick:
    candidate: Candidate
    offbeat: bool = False
    why: str = ""


@dataclass
class Selection:
    picks: list[Pick]
    note: str = ""
    ranked: bool = True  # False when Claude's answer was unusable and we fell back


def _age(published: datetime | None, now: datetime) -> str:
    if published is None:
        return "time unknown"
    if published.tzinfo is None:
        published = published.replace(tzinfo=UTC)
    hours = max(0, int((now - published).total_seconds() // 3600))
    return f"{hours}h ago"


def _teaser(text: str) -> str:
    plain = re.sub(r"<[^>]+>", " ", text or "")
    plain = re.sub(r"\s+", " ", plain).strip()
    return plain[:TEASER_CHARS] + ("…" if len(plain) > TEASER_CHARS else "")


def _format_line(i: int, c: Candidate, now: datetime) -> str:
    src = c.source
    tags = src.get("region", "?") + (", offbeat desk" if src.get("offbeat") else "")
    line = f"[{i}] {src['name']} ({tags}) · {_age(c.fetched.published_at, now)} · {c.fetched.title}"
    teaser = _teaser(c.fetched.raw_content)
    return f"{line} — {teaser}" if teaser else line


def parse_selection(text: str, candidates: list[Candidate], maximum: int) -> Selection | None:
    """Turn Claude's JSON into picks. Returns None when the reply is unusable."""
    match = re.search(r"\{.*\}", text or "", re.S)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    stories = data.get("stories") if isinstance(data, dict) else None
    if not isinstance(stories, list):
        return None

    picks: list[Pick] = []
    used: set[int] = set()
    for story in stories:
        if not isinstance(story, dict):
            continue
        idx = story.get("id")
        # Only ids we actually sent: Claude must not be able to invent a story.
        if not isinstance(idx, int) or not 0 <= idx < len(candidates) or idx in used:
            continue
        used.add(idx)
        for other in story.get("also") or []:
            if isinstance(other, int):
                used.add(other)  # same story from another outlet: never picked separately
        picks.append(
            Pick(
                candidate=candidates[idx],
                offbeat=bool(story.get("offbeat")),
                why=str(story.get("why") or "")[:300],
            )
        )
        if len(picks) >= maximum:
            break
    note = data.get("note") if isinstance(data.get("note"), str) else ""
    return Selection(picks=picks, note=note.strip())


def fallback_selection(candidates: list[Candidate], target: int) -> Selection:
    """Newest stories, one feed at a time, so a failed ranking still yields a day's news."""
    by_feed: dict[str, list[Candidate]] = {}
    for c in candidates:
        by_feed.setdefault(c.source["url"], []).append(c)
    oldest = datetime.min.replace(tzinfo=UTC)

    def when(c: Candidate) -> datetime:
        p = c.fetched.published_at
        return oldest if p is None else (p if p.tzinfo else p.replace(tzinfo=UTC))

    queues = [sorted(q, key=when, reverse=True) for q in by_feed.values()]
    picks: list[Pick] = []
    while len(picks) < target and any(queues):
        for q in queues:
            if q and len(picks) < target:
                picks.append(Pick(candidate=q.pop(0)))
    return Selection(picks=picks, note="ranking unavailable; newest stories used", ranked=False)


class StoryRanker:
    """Chooses which candidates become today's stories (see module docstring)."""

    def __init__(self, llm: LLMClient, target: int = 12, maximum: int = 15) -> None:
        self.llm = llm
        self.target = target
        self.maximum = max(maximum, target)

    async def select(self, candidates: list[Candidate], now: datetime | None = None) -> Selection:
        if not candidates:
            return Selection(picks=[])
        now = now or datetime.now(UTC)
        prompt = RANK_PROMPT.format(
            now=now.strftime("%Y-%m-%d %H:%M UTC"),
            count=len(candidates),
            lines="\n".join(_format_line(i, c, now) for i, c in enumerate(candidates)),
        )
        system = RANK_SYSTEM.format(target=self.target, maximum=self.maximum)
        try:
            reply = await self.llm.generate(
                prompt, effort="medium", system=system, max_tokens=16000
            )
        except Exception:
            logger.error("Story ranking call failed", exc_info=True)
            reply = ""
        selection = parse_selection(reply, candidates, self.maximum)
        if selection is None or not selection.picks:
            if selection is not None and selection.note:
                # Claude looked and found nothing worth running: respect that.
                logger.info("Ranker chose no stories: %s", selection.note)
                return selection
            logger.warning("Ranker reply unusable; falling back to newest stories")
            return fallback_selection(candidates, self.target)
        for p in selection.picks:
            logger.info(
                "Picked%s: %s (%s) — %s",
                " [offbeat]" if p.offbeat else "",
                p.candidate.fetched.title,
                p.candidate.source["name"],
                p.why,
            )
        if selection.note:
            logger.info("Ranker note: %s", selection.note)
        return selection
