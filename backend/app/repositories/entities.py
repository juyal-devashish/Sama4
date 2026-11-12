"""Entity queries."""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entity import ArticleEntity, Entity


async def get(db: AsyncSession, entity_id: uuid.UUID) -> Entity | None:
    return await db.get(Entity, entity_id)


async def list_co_occurring(db: AsyncSession, entity: Entity, limit: int = 5) -> Sequence[Entity]:
    """Other entities that appear in the same articles as `entity`."""
    article_ids = select(ArticleEntity.article_id).where(ArticleEntity.entity_id == entity.id)
    rows = await db.execute(
        select(Entity)
        .join(ArticleEntity, ArticleEntity.entity_id == Entity.id)
        .where(ArticleEntity.article_id.in_(article_ids), Entity.id != entity.id)
        .distinct()
        .limit(limit)
    )
    return rows.scalars().all()


async def get_or_create(
    db: AsyncSession,
    *,
    name: str,
    entity_type: str,
    wikidata_id: str | None = None,
    wikipedia_url: str | None = None,
    short_context: str | None = None,
) -> Entity:
    """Find an entity by (name, type) or create it. New entities are flushed to get an id."""
    entity = (
        await db.execute(
            select(Entity).where(Entity.canonical_name == name, Entity.entity_type == entity_type)
        )
    ).scalar_one_or_none()
    if entity is None:
        entity = Entity(
            canonical_name=name,
            entity_type=entity_type,
            wikidata_id=wikidata_id,
            wikipedia_url=wikipedia_url,
            short_context=short_context,
            popularity_score=0,
        )
        db.add(entity)
        await db.flush()
    return entity
