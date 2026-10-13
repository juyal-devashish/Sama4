"""Entity linker service — NER extraction + Wikidata enrichment + DB persistence.

Combines the NER and Wikidata services into a single pipeline that processes
multiple entities concurrently with a semaphore to respect API rate limits.
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingestion.ner import ExtractedEntity
from app.models.entity import ArticleEntity, Entity
from app.services.ner_service import NERService
from app.services.wikidata import EntityFacts, WikidataService

logger = logging.getLogger(__name__)

# Max concurrent Wikidata API calls (Wikimedia asks for politeness)
_MAX_CONCURRENT = 5


@dataclass
class LinkedEntity:
    """An entity after NER extraction + Wikidata enrichment."""

    text: str
    entity_type: str
    start: int
    end: int
    in_title: bool
    mention_count: int
    priority: str
    # Wikidata enrichment (None if lookup failed or entity not found)
    wikidata_id: str | None = None
    wikipedia_url: str | None = None
    description: str | None = None
    facts: dict[str, str] = field(default_factory=dict)


class EntityLinkerService:
    """Full pipeline: extract entities → enrich via Wikidata → persist to DB."""

    def __init__(
        self,
        ner: NERService | None = None,
        wikidata: WikidataService | None = None,
        max_concurrent: int = _MAX_CONCURRENT,
    ) -> None:
        self._ner = ner or NERService()
        self._wikidata = wikidata or WikidataService()
        self._semaphore = asyncio.Semaphore(max_concurrent)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    async def extract_and_link(
        self, content: str, title: str
    ) -> list[LinkedEntity]:
        """Extract entities from text and enrich them via Wikidata.

        Runs NER first, then enriches all entities concurrently.

        Args:
            content: Article body text.
            title: Article title.

        Returns:
            List of LinkedEntity with Wikidata facts attached.
        """
        extracted = await self._ner.extract(content, title)
        if not extracted:
            return []

        return await self._enrich_batch(extracted)

    async def extract_link_and_store(
        self,
        article_id: uuid.UUID,
        content: str,
        title: str,
        db: AsyncSession,
    ) -> list[Entity]:
        """Full pipeline: NER → Wikidata enrichment → DB persistence.

        Args:
            article_id: UUID of the article being processed.
            content: Article body text.
            title: Article title.
            db: Async database session.

        Returns:
            List of persisted Entity objects.
        """
        linked = await self.extract_and_link(content, title)
        if not linked:
            return []

        return await self._persist_batch(article_id, linked, db)

    # ------------------------------------------------------------------
    # Concurrent enrichment
    # ------------------------------------------------------------------
    async def _enrich_batch(
        self, entities: list[ExtractedEntity]
    ) -> list[LinkedEntity]:
        """Enrich all entities concurrently, respecting the semaphore."""
        tasks = [self._enrich_one(ent) for ent in entities]
        return await asyncio.gather(*tasks)

    async def _enrich_one(self, ent: ExtractedEntity) -> LinkedEntity:
        """Search Wikidata + fetch facts for a single entity."""
        async with self._semaphore:
            try:
                facts_result = await self._wikidata.search_and_get_facts(
                    ent.text, ent.type
                )
            except Exception:
                logger.warning("Wikidata lookup failed for '%s'", ent.text, exc_info=True)
                facts_result = None

        return self._merge(ent, facts_result)

    @staticmethod
    def _merge(
        ent: ExtractedEntity, facts: EntityFacts | None
    ) -> LinkedEntity:
        """Combine NER extraction with Wikidata facts into a LinkedEntity."""
        if facts is None:
            return LinkedEntity(
                text=ent.text,
                entity_type=ent.type,
                start=ent.start,
                end=ent.end,
                in_title=ent.in_title,
                mention_count=ent.mention_count,
                priority=ent.priority,
            )

        return LinkedEntity(
            text=ent.text,
            entity_type=ent.type,
            start=ent.start,
            end=ent.end,
            in_title=ent.in_title,
            mention_count=ent.mention_count,
            priority=ent.priority,
            wikidata_id=facts.qid,
            wikipedia_url=facts.wikipedia_url,
            description=facts.description,
            facts=facts.facts,
        )

    # ------------------------------------------------------------------
    # DB persistence
    # ------------------------------------------------------------------
    async def _persist_batch(
        self,
        article_id: uuid.UUID,
        linked: list[LinkedEntity],
        db: AsyncSession,
    ) -> list[Entity]:
        """Persist linked entities and their article associations."""
        persisted: list[Entity] = []

        for ent in linked:
            entity = await self._get_or_create_entity(db, ent)
            entity.popularity_score = (entity.popularity_score or 0) + 1

            link = ArticleEntity(
                article_id=article_id,
                entity_id=entity.id,
                mention_text=ent.text,
                start_position=ent.start,
                end_position=ent.end,
                priority=ent.priority,
                in_title=ent.in_title,
                mention_count=ent.mention_count,
            )
            db.add(link)
            persisted.append(entity)

        await db.commit()
        logger.info(
            "Linked and stored %d entities for article %s", len(persisted), article_id
        )
        return persisted

    @staticmethod
    async def _get_or_create_entity(
        db: AsyncSession, ent: LinkedEntity
    ) -> Entity:
        """Find existing entity by name+type or create with Wikidata data."""
        result = await db.execute(
            select(Entity).where(
                Entity.canonical_name == ent.text,
                Entity.entity_type == ent.entity_type,
            )
        )
        entity = result.scalar_one_or_none()

        if entity is None:
            entity = Entity(
                canonical_name=ent.text,
                entity_type=ent.entity_type,
                wikidata_id=ent.wikidata_id,
                wikipedia_url=ent.wikipedia_url,
                short_context=ent.description,
            )
            db.add(entity)
            await db.flush()
        else:
            # Update Wikidata fields if we have new data and entity lacks it
            if ent.wikidata_id and not entity.wikidata_id:
                entity.wikidata_id = ent.wikidata_id
            if ent.wikipedia_url and not entity.wikipedia_url:
                entity.wikipedia_url = ent.wikipedia_url
            if ent.description and not entity.short_context:
                entity.short_context = ent.description

        return entity
