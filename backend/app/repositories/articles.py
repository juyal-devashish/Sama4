"""Article queries. All SQL for articles lives here; routers and services call these."""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import IS_SQLITE
from app.models.article import Article
from app.models.entity import ArticleEntity, Entity
from app.models.source import Source

# Lifecycle: an article row is stored "completed" once every pipeline step succeeds.
# If a step fails, its savepoint rolls the article back and the pipeline stores a
# content-free "failed" row instead, so the URL isn't re-processed every run; it is
# retried once that row is FAILED_RETRY_AFTER old. Only "completed" rows are shown.
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"
FAILED_RETRY_AFTER = timedelta(hours=6)


@dataclass
class FeedRow:
    article: Article
    source: Source | None
    entity_count: int


async def list_feed(
    db: AsyncSession, *, page: int, limit: int, category: str | None = None
) -> tuple[list[FeedRow], int]:
    """Completed articles with their entity counts. Returns (rows, total).

    Newest scrape first: the latest nightly run's stories (grouped by the UTC day they
    were stored) sit on top, newest-published first within that day. Articles with no
    publish date go last in their day instead of floating to the top.
    """
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
        .order_by(
            func.date(Article.created_at).desc(),
            Article.published_at.desc().nulls_last(),
            Article.created_at.desc(),
        )
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


async def get_by_url(db: AsyncSession, url: str) -> Article | None:
    return (await db.execute(select(Article).where(Article.url == url).limit(1))).scalars().first()


def due_for_retry(article: Article, now: datetime | None = None) -> bool:
    """True for a "failed" row old enough to try the URL again."""
    if article.processing_status != STATUS_FAILED:
        return False
    last = article.updated_at or article.created_at
    if last is None:
        return True
    if last.tzinfo is None:  # SQLite returns naive datetimes; they are UTC
        last = last.replace(tzinfo=UTC)
    return (now or datetime.now(UTC)) - last >= FAILED_RETRY_AFTER


async def record_failure(
    db: AsyncSession,
    *,
    url: str,
    title: str,
    source_id: uuid.UUID,
    category: str,
    published_at: datetime | None,
    error: str,
) -> None:
    """Store (or refresh) the content-free "failed" row for a URL that didn't process."""
    row = await get_by_url(db, url)
    if row is None:
        row = Article(
            url=url,
            title=title,
            source_id=source_id,
            categories=[category],
            published_at=published_at,
        )
        db.add(row)
    row.processing_status = STATUS_FAILED
    row.processing_error = error[:1000]
    row.updated_at = datetime.now(UTC)
    await db.flush()


async def list_all(db: AsyncSession) -> Sequence[Article]:
    return (await db.execute(select(Article))).scalars().all()


async def list_recent_with_source(
    db: AsyncSession, limit: int
) -> list[tuple[Article, Source | None]]:
    """The newest completed articles (as the feed orders them) with their sources."""
    rows = await db.execute(
        select(Article, Source)
        .join(Source, Article.source_id == Source.id, isouter=True)
        .where(Article.processing_status == STATUS_COMPLETED)
        .order_by(Article.created_at.desc())
        .limit(limit)
    )
    return [(a, s) for a, s in rows.all()]


async def delete_mentions(db: AsyncSession, article_id: uuid.UUID) -> None:
    """Remove an article's mentions (before re-annotating changed text)."""
    await db.execute(delete(ArticleEntity).where(ArticleEntity.article_id == article_id))
    await db.flush()


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
