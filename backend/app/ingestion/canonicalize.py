"""One-off cleanup of stored entities written before NER canonicalized them.

Two problems, both visible to readers:
- Possessive names stored as their own entity ("Jensen Huang's" next to "Jensen Huang"),
  shown as a separate person with no explanation.
- spaCy's wrong types ("Nvidia" stored as LOCATION, so it was listed under Places).

`canonicalize_entities` strips possessives, asks Claude to type every entity name (in
batches, with a headline for context), then renames/retypes each entity in place, or
merges it into the entity that already has the canonical (name, type). Mentions follow:
their text loses the possessive and their end offset moves with it.
"""

import json
import logging
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.llm import LLMClient
from app.ingestion.ner import normalize_llm_type, strip_possessive
from app.models.article import Article
from app.models.entity import ArticleEntity, Entity

logger = logging.getLogger(__name__)

TYPE_BATCH = 100
MAX_LISTED_CHANGES = 50


@dataclass
class EntityCleanupReport:
    entities: int = 0
    renamed: int = 0  # possessive stripped, kept as its own entity
    retyped: int = 0  # type corrected in place
    merged: int = 0  # folded into an existing entity with the canonical name and type
    mentions_fixed: int = 0  # mention text/offsets trimmed
    mentions_dropped: int = 0  # duplicate of a mention the target already had
    typed_by_claude: bool = False
    dry_run: bool = True
    changes: list[str] = field(default_factory=list)


async def classify_types(llm: LLMClient, items: list[tuple[str, str | None]]) -> dict[str, str]:
    """{lowercased name: PERSON|ORG|LOCATION|EVENT|CONCEPT} for (name, a headline it's in)."""
    out: dict[str, str] = {}
    for i in range(0, len(items), TYPE_BATCH):
        batch = items[i : i + TYPE_BATCH]
        listing = "\n".join(
            f"- {name}" + (f"  (in: {headline[:90]})" if headline else "")
            for name, headline in batch
        )
        prompt = (
            "Classify each name from a news site as PERSON, ORG, LOCATION, EVENT or CONCEPT.\n"
            "Companies, agencies, teams and institutions are ORG, never LOCATION. A headline "
            "is given where it helps disambiguate.\n\n"
            f"{listing}\n\n"
            "Return ONLY a JSON object mapping each name exactly as listed to its type, e.g. "
            '{"Nvidia": "ORG"}.'
        )
        raw = (await llm.generate(prompt, effort="low")).strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Entity type batch %d: unparseable reply, skipped", i // TYPE_BATCH)
            continue
        if isinstance(parsed, dict):
            out.update({str(k).lower(): normalize_llm_type(v) for k, v in parsed.items()})
    return out


async def canonicalize_entities(
    db: AsyncSession, llm: LLMClient, *, dry_run: bool = True, retype: bool = True
) -> EntityCleanupReport:
    report = EntityCleanupReport(dry_run=dry_run)
    entities = list((await db.execute(select(Entity))).scalars().all())
    report.entities = len(entities)

    headline: dict = {}
    for entity_id, title in await db.execute(
        select(ArticleEntity.entity_id, Article.title).join(
            Article, Article.id == ArticleEntity.article_id
        )
    ):
        headline.setdefault(entity_id, title)

    types: dict[str, str] = {}
    if retype and llm.available:
        names = {strip_possessive(e.canonical_name): headline.get(e.id) for e in entities}
        types = await classify_types(llm, list(names.items()))
        report.typed_by_claude = True

    by_key = {(e.canonical_name, e.entity_type): e for e in entities}
    # Most-mentioned first, so the established row is the one others merge into.
    for entity in sorted(entities, key=lambda e: -(e.popularity_score or 0)):
        old = (entity.canonical_name, entity.entity_type)
        name = strip_possessive(entity.canonical_name)
        new = (name, types.get(name.lower(), entity.entity_type))
        if new == old:
            continue
        target = by_key.get(new)
        if target is entity:
            continue
        if len(report.changes) < MAX_LISTED_CHANGES:
            verb = "merge into" if target is not None else "rename to"
            report.changes.append(f"{old[0]} ({old[1]}) -> {verb} {new[0]} ({new[1]})")

        mentions = list(
            (await db.execute(select(ArticleEntity).where(ArticleEntity.entity_id == entity.id)))
            .scalars()
            .all()
        )
        taken: set = set()
        if target is not None:
            taken = {
                (m.article_id, m.start_position)
                for m in (
                    await db.execute(
                        select(ArticleEntity).where(ArticleEntity.entity_id == target.id)
                    )
                ).scalars()
            }

        for m in mentions:
            text = strip_possessive(m.mention_text)
            if text != m.mention_text:
                report.mentions_fixed += 1
                if not dry_run:
                    m.end_position -= len(m.mention_text) - len(text)
                    m.mention_text = text
            if target is not None and not dry_run:
                if (m.article_id, m.start_position) in taken:
                    report.mentions_dropped += 1
                    await db.delete(m)
                else:
                    m.entity = target
            elif target is not None and (m.article_id, m.start_position) in taken:
                report.mentions_dropped += 1

        if target is not None:
            report.merged += 1
            if not dry_run:
                target.popularity_score = (target.popularity_score or 0) + (
                    entity.popularity_score or 0
                )
                target.wikipedia_url = target.wikipedia_url or entity.wikipedia_url
                target.wikidata_id = target.wikidata_id or entity.wikidata_id
                target.short_context = target.short_context or entity.short_context
                await db.flush()
                await db.delete(entity)
            del by_key[old]
        else:
            if new[0] != old[0]:
                report.renamed += 1
            if new[1] != old[1]:
                report.retyped += 1
            if not dry_run:
                entity.canonical_name, entity.entity_type = new
            del by_key[old]
            by_key[new] = entity
        if not dry_run:
            await db.flush()

    if not dry_run:
        await db.commit()
    return report
