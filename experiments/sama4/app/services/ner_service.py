import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingestion.ner import ExtractedEntity, NERService as _NEREngine
from app.models.entity import Entity, ArticleEntity

logger = logging.getLogger(__name__)

# Module-level singleton — spaCy model loaded once, reused across requests.
_engine = _NEREngine()


class NERServiceError(Exception):
    """Raised when entity extraction fails."""


class NERService:
    """Service layer for Named Entity Recognition.

    Wraps the ingestion NER engine and adds DB persistence so that
    routers / other services can extract-and-store in one call.
    """

    async def extract(self, content: str, title: str) -> list[ExtractedEntity]:
        """Extract entities from text without persisting (spaCy only).

        Args:
            content: Article body text.
            title: Article title (used for priority scoring).

        Returns:
            Sorted list of extracted entities.
        """
        try:
            return _engine.extract_entities(content, title)
        except Exception as exc:
            logger.error(f"NER extraction failed: {exc}")
            raise NERServiceError(str(exc)) from exc

    async def extract_hybrid(
        self, content: str, title: str, categories: list[str] | None = None
    ) -> list[ExtractedEntity]:
        """Extract entities using spaCy + LLM knowledge-gap detection.

        This is the preferred method — it identifies terms a reader wouldn't
        know, not just standard named entities.
        """
        try:
            return await _engine.extract_entities_hybrid(content, title, categories)
        except Exception as exc:
            logger.error(f"Hybrid NER extraction failed: {exc}")
            raise NERServiceError(str(exc)) from exc

    async def extract_and_store(
        self,
        article_id: uuid.UUID,
        content: str,
        title: str,
        db: AsyncSession,
    ) -> list[Entity]:
        """Extract entities and persist them to the database.

        Reuses existing Entity rows when a (canonical_name, entity_type) pair
        already exists. Creates ArticleEntity join rows with position and
        priority metadata for highlighting.

        Args:
            article_id: UUID of the article being processed.
            content: Article body text.
            title: Article title.
            db: Async database session.

        Returns:
            List of Entity objects linked to the article.
        """
        extracted = await self.extract(content, title)
        if not extracted:
            return []

        persisted: list[Entity] = []

        for ent in extracted:
            # Upsert: reuse existing entity or create new one
            entity = await self._get_or_create_entity(db, ent)

            # Bump popularity every time the entity appears in a new article
            entity.popularity_score += 1

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
            f"Stored {len(persisted)} entities for article {article_id}"
        )
        return persisted

    async def _get_or_create_entity(
        self, db: AsyncSession, ent: ExtractedEntity
    ) -> Entity:
        """Find an existing entity by name+type or create a new one."""
        result = await db.execute(
            select(Entity).where(
                Entity.canonical_name == ent.text,
                Entity.entity_type == ent.type,
            )
        )
        entity = result.scalar_one_or_none()

        if entity is None:
            entity = Entity(
                canonical_name=ent.text,
                entity_type=ent.type,
            )
            db.add(entity)
            await db.flush()  # assign UUID

        return entity
