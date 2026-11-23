"""Re-choose the Wikipedia page of terms already stored, using their story.

Entities linked before the linker asked Claude carry Wikidata's top hit: "ICE" the German
train, "status quo" the rock band. The citation under an explanation, the References
page and the fallback explanation (`short_context`) all show that page. This job takes
the terms in the newest stories, asks Claude which candidate the story means (the same
choice the linker makes for new terms), and rewrites the link, the extract and the cached
explanations that cite the old page.

Fails safe: a term Claude gives no answer for is left as it is.
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.cache import Cache
from app.clients.wikimedia import WikidataCandidate, title_from_url
from app.ingestion.linker import EntityLinker
from app.ingestion.page_choice import TermToLink, passage_around
from app.models.entity import Entity
from app.repositories import entities as entity_repo

logger = logging.getLogger(__name__)

MAX_LISTED_CHANGES = 100


@dataclass
class RelinkReport:
    stories: int = 0
    entities: int = 0
    changed: int = 0  # a different page, or no page where the old one was wrong
    unchanged: int = 0
    unanswered: int = 0  # Claude gave no answer: left as it was
    cache_keys_cleared: int = 0
    dry_run: bool = True
    changes: list[str] = field(default_factory=list)


def explanation_cache_keys(entity_id: uuid.UUID, article_ids: list[uuid.UUID]) -> list[str]:
    """Every cached explanation of an entity. Must match `ContextService.cache_key` and its
    "more detail" twin (a test checks they agree)."""
    bases = [f"context:entity:{entity_id}"] + [
        f"context:entity:{entity_id}:article:{a}" for a in article_ids
    ]
    return bases + [b.replace("context:entity:", "context:entity-more:") for b in bases]


def _page_name(url: str | None) -> str:
    return title_from_url(url).replace("_", " ") if url else "no page"


async def relink_entities(
    db: AsyncSession,
    linker: EntityLinker,
    cache: Cache,
    *,
    stories: int = 30,
    dry_run: bool = True,
) -> RelinkReport:
    """Re-choose the page of every term in the `stories` newest stories.

    Dry run by default: the report lists what would change. Raises if Claude isn't
    configured, since without it there is nothing better than the link already stored.
    """
    if linker.llm is None or not linker.llm.available:
        raise RuntimeError("Re-linking needs Claude")
    report = RelinkReport(dry_run=dry_run)

    first: dict[uuid.UUID, tuple[Entity, str, str]] = {}  # entity id -> (entity, headline, passage)
    story_ids = set()
    for entity, article, mention in await entity_repo.mentions_in_newest_stories(db, stories):
        story_ids.add(article.id)
        if entity.id not in first:
            content = article.cleaned_content or article.raw_content or ""
            passage = passage_around(content, mention.start_position, mention.end_position)
            first[entity.id] = (entity, article.title, passage)
    report.stories, report.entities = len(story_ids), len(first)

    async def lookup(name: str) -> list[WikidataCandidate] | None:
        try:
            return await linker.candidates(name)
        except Exception:
            logger.warning("Wikidata lookup failed for %r", name, exc_info=True)
            return None

    entries = list(first.values())
    found = await asyncio.gather(*(lookup(e.canonical_name) for e, _h, _p in entries))
    terms = [
        TermToLink(
            key=str(e.id),
            text=e.canonical_name,
            type=e.entity_type,
            headline=headline,
            context=passage,
            candidates=cands,
        )  # fmt: skip
        for (e, headline, passage), cands in zip(entries, found, strict=True)
        if cands is not None
    ]
    report.unanswered += len(entries) - len(terms)
    chosen = await linker.choose(terms)
    answered = [t for t in terms if t.key in chosen]
    report.unanswered += len(terms) - len(answered)
    pages = await asyncio.gather(*(linker.page_for(chosen[t.key]) for t in answered))

    for term, (url, extract) in zip(answered, pages, strict=True):
        entity = first[uuid.UUID(term.key)][0]
        if url == entity.wikipedia_url:
            report.unchanged += 1
            continue
        report.changed += 1
        if len(report.changes) < MAX_LISTED_CHANGES:
            report.changes.append(
                f"{entity.canonical_name} ({entity.entity_type}): "
                f"{_page_name(entity.wikipedia_url)} -> {_page_name(url)}"
            )
        if dry_run:
            continue
        entity.wikidata_id = chosen[term.key]
        entity.wikipedia_url = url
        entity.short_context = extract
        article_ids = await entity_repo.article_ids_mentioning(db, entity.id)
        for key in explanation_cache_keys(entity.id, article_ids):
            await cache.delete(key)
            report.cache_keys_cleared += 1

    if not dry_run:
        await db.commit()
    logger.info("Relink: %s", {k: v for k, v in vars(report).items() if k != "changes"})
    return report
