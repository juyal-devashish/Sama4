"""Build the context-feature evaluation set: term + story pairs with a gold referent.

    poetry run python -m evals.build_context_eval [--api URL] [--size 200] [--out PATH]

Reads published stories through the public API (no database or keys needed), then
samples term mentions so the set covers every entity type and over-samples the hard
cases: bare surnames and single words, and names linked to different Wikipedia pages
in different stories. Each item records what the linker chose; `gold` is filled in by
review (see evals/README.md), so the set measures whether Samā4 explained the right
thing, not whether it agrees with itself.

Only this script touches the network. The sampling functions are pure and tested.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path

import httpx

DEFAULT_API = "https://sama4-api-production.up.railway.app/api/v1"
DEFAULT_OUT = Path(__file__).parent / "context_eval.jsonl"
EXCERPT_RADIUS = 300  # matches services.context.EXCERPT_RADIUS
PER_STORY = 2
AMBIGUOUS_SHARE = 0.3

TYPE_GROUPS = {  # spaCy labels and the app's own (the stored types are mixed)
    "PERSON": "person",
    "ORG": "organization",
    "ORGANIZATION": "organization",
    "LOCATION": "location",
    "CONCEPT": "concept",
    "NORP": "organization",
    "GPE": "location",
    "LOC": "location",
    "FAC": "location",
    "EVENT": "event",
}


@dataclass
class EvalItem:
    id: str
    term: str
    entity_type: str
    entity_id: str
    article_id: str
    article_title: str
    source: str
    excerpt: str
    linked_wikipedia_url: str | None
    stored_context: str | None
    tags: list[str] = field(default_factory=list)
    # Filled by review: the Wikipedia URL of what the term means *in this story*
    # (null if it has no article), whether the linker matched it, and who checked.
    gold: dict = field(
        default_factory=lambda: {
            "wikipedia_url": None,
            "linker_correct": None,
            "note": "",
            "labelled_by": None,
            "human_verified": False,
        }
    )


def type_group(entity_type: str) -> str:
    return TYPE_GROUPS.get(entity_type.upper(), "concept")


def excerpt_around(text: str, start: int, end: int, radius: int = EXCERPT_RADIUS) -> str:
    """Text around a mention, snapped to word boundaries, with ellipses when cut."""
    a, b = max(0, start - radius), min(len(text), end + radius)
    if a > 0 and (space := text.find(" ", a, start)) != -1:
        a = space + 1
    if b < len(text) and (space := text.rfind(" ", end, b)) != -1:
        b = space
    return ("…" if a > 0 else "") + text[a:b].strip() + ("…" if b < len(text) else "")


def ambiguity_tags(term: str, linked_urls: set[str]) -> list[str]:
    """Why a mention is hard to pin down: one bare word, or linked to several pages."""
    tags = []
    words = [w for w in term.replace("the ", "").split() if w]
    if len(words) == 1:
        tags.append("single_word")
    if len(linked_urls) > 1:
        tags.append("linked_to_several_pages")
    return tags


def candidates(stories: list[dict]) -> list[EvalItem]:
    """Every first mention of every term in every story, with its tags."""
    urls_by_name: dict[str, set[str]] = defaultdict(set)
    for story in stories:
        for e in story["reference_entities"]:
            if e.get("wikipedia_url"):
                urls_by_name[e["name"].lower()].add(e["wikipedia_url"])

    items: list[EvalItem] = []
    for story in stories:
        article = story["article"]
        content = article.get("content") or ""
        by_id = {e["id"]: e for e in story["reference_entities"]}
        seen: set[str] = set()
        for m in article.get("entities", []):
            ref = by_id.get(m["id"])
            if ref is None or m["id"] in seen or not content:
                continue
            if content[m["start"] : m["end"]] != m["text"]:
                continue  # stale offsets: the passage wouldn't show the term
            seen.add(m["id"])
            items.append(
                EvalItem(
                    id=f"{article['id']}:{m['id']}",
                    term=m["text"],
                    entity_type=m["type"],
                    entity_id=m["id"],
                    article_id=article["id"],
                    article_title=article["title"],
                    source=(article.get("source") or {}).get("name", ""),
                    excerpt=excerpt_around(content, m["start"], m["end"]),
                    linked_wikipedia_url=ref.get("wikipedia_url"),
                    stored_context=ref.get("context"),
                    tags=ambiguity_tags(ref["name"], urls_by_name[ref["name"].lower()]),
                )
            )
    return items


def sample(items: list[EvalItem], size: int, seed: int = 4) -> list[EvalItem]:
    """`size` items: no term twice, at most PER_STORY per story, types balanced, and
    about AMBIGUOUS_SHARE of them tagged as ambiguous."""
    rng = random.Random(seed)
    pool = items[:]
    rng.shuffle(pool)
    hard = [i for i in pool if i.tags]
    easy = [i for i in pool if not i.tags]

    chosen: list[EvalItem] = []
    terms: set[str] = set()
    per_story: dict[str, int] = defaultdict(int)

    def take(group: list[EvalItem], quota: int) -> None:
        by_type: dict[str, list[EvalItem]] = defaultdict(list)
        for item in group:
            by_type[type_group(item.entity_type)].append(item)
        queues = list(by_type.values())
        taken = 0
        while taken < quota and any(queues):
            for q in queues:  # round-robin across types
                while q:
                    item = q.pop()
                    key = item.term.lower()
                    if key in terms or per_story[item.article_id] >= PER_STORY:
                        continue
                    chosen.append(item)
                    terms.add(key)
                    per_story[item.article_id] += 1
                    taken += 1
                    break
                if taken >= quota:
                    break

    take(hard, round(size * AMBIGUOUS_SHARE))
    take(easy, size - len(chosen))
    take(hard, size - len(chosen))  # top up if there weren't enough easy ones
    return chosen[:size]


async def fetch_stories(api: str, limit: int) -> list[dict]:
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "sama4-evals"}) as http:
        ids: list[str] = []
        page = 1
        while len(ids) < limit:
            res = (await http.get(f"{api}/feed", params={"page": page, "limit": 100})).json()
            ids += [a["id"] for a in res["articles"]]
            if not res["pagination"]["has_next"]:
                break
            page += 1
        gate = asyncio.Semaphore(4)

        async def one(article_id: str) -> dict | None:
            async with gate:
                r = await http.get(f"{api}/articles/{article_id}/reference")
            if r.status_code != 200:
                return None
            body = r.json()
            return {"article": body["article"], "reference_entities": body["entities"]}

        stories = await asyncio.gather(*(one(i) for i in ids[:limit]))
    return [s for s in stories if s]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--api", default=DEFAULT_API)
    parser.add_argument("--size", type=int, default=200)
    parser.add_argument("--stories", type=int, default=300, help="stories to sample from")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    stories = asyncio.run(fetch_stories(args.api, args.stories))
    items = sample(candidates(stories), args.size)
    with args.out.open("w") as f:
        for item in items:
            f.write(json.dumps(asdict(item), ensure_ascii=False) + "\n")
    hard = sum(1 for i in items if i.tags)
    print(f"{len(items)} items from {len(stories)} stories ({hard} ambiguous) -> {args.out}")


if __name__ == "__main__":
    main()
