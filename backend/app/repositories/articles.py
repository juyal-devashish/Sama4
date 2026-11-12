"""Article queries. All SQL for articles lives here; routers and services call these."""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import IS_SQLITE
from app.models.article import Article
from app.models.entity import ArticleEntity, Entity
from app.models.source import Source

STATUS_COMPLETED = "completed"


@dataclass
class FeedRow:
    article: Article
    source: Source | None
    entity_count: int


async def list_feed(
    db: AsyncSession, *, page: int, limit: int, category: str | None = None
) -> tuple[list[FeedRow], int]:
    """Completed articles, newest first, with their entity counts. Returns (rows, total)."""
    entity_counts = (
        select(ArticleEntity.article_id, func.count().label("n"))
        .group_by(ArticleEntity.article_id)
        .subquery()
    )
    query = (
        select(Article, Source, func.coalesce(entity_counts.c.n, 0))
        .join(Source, Article.source_id == Source.id, isouter=True)
        .join(entity_counts, entity_counts.c.article_id == Article.id, isouter=True)
        .where(Article.processing_status == STATUS_COMPLETED)
        .order_by(Article.published_at.desc())
    )
    if category:
        if IS_SQLITE:
            # categories is a JSON array on SQLite
            query = query.where(
                text(
                    "EXISTS (SELECT 1 FROM json_each(articles.categories)"
                    " WHERE json_each.value = :cat)"
                )
            ).params(cat=category)
        else:
            query = query.where(Article.categories.contains([category]))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    rows = (await db.execute(query.offset((page - 1) * limit).limit(limit))).all()
    return [FeedRow(article=a, source=s, entity_count=n) for a, s, n in rows], total


async def get_with_source(
    db: AsyncSession, article_id: uuid.UUID
) -> tuple[Article, Source | None] | None:
    row = (
        await db.execute(
            select(Article, Source)
            .join(Source, Article.source_id == Source.id, isouter=True)
            .where(Article.id == article_id)
        )
    ).first()
    return (row[0], row[1]) if row else None


async def get(db: AsyncSession, article_id: uuid.UUID) -> Article | None:
    return await db.get(Article, article_id)


async def exists_by_url(db: AsyncSession, url: str) -> bool:
    return (
        await db.execute(select(Article.id).where(Article.url == url).limit(1))
    ).first() is not None


async def list_all(db: AsyncSession) -> Sequence[Article]:
    return (await db.execute(select(Article))).scalars().all()


async def list_mentions(
    db: AsyncSession, article_id: uuid.UUID
) -> list[tuple[ArticleEntity, Entity]]:
    """Entity mentions in an article, in text order (for highlighting)."""
    rows = await db.execute(
        select(ArticleEntity, Entity)
        .join(Entity, ArticleEntity.entity_id == Entity.id)
        .where(ArticleEntity.article_id == article_id)
        .order_by(ArticleEntity.start_position)
    )
    return [(ae, e) for ae, e in rows.all()]


async def list_entities_by_popularity(db: AsyncSession, article_id: uuid.UUID) -> Sequence[Entity]:
    rows = await db.execute(
        select(Entity)
        .join(ArticleEntity, ArticleEntity.entity_id == Entity.id)
        .where(ArticleEntity.article_id == article_id)
        .order_by(Entity.popularity_score.desc())
    )
    return rows.scalars().all()
