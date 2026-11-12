"""Helpers to insert rows for tests."""

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.entity import ArticleEntity, Entity
from app.models.source import Source


async def make_source(db: AsyncSession, name: str = "Test Source") -> Source:
    source = Source(name=name, feed_url=f"https://feeds.test/{uuid.uuid4().hex}", categories=[])
    db.add(source)
    await db.flush()
    return source


async def make_article(
    db: AsyncSession,
    *,
    source: Source | None = None,
    title: str = "Test article",
    content: str = "Some article text.",
    summary: str | None = "A summary.",
    categories: list[str] | None = None,
    status: str = "completed",
    published_at: datetime | None = None,
) -> Article:
    article = Article(
        source_id=source.id if source else None,
        url=f"https://news.test/{uuid.uuid4().hex}",
        title=title,
        cleaned_content=content,
        summary=summary,
        categories=categories or ["world"],
        processing_status=status,
        published_at=published_at or datetime.now(UTC),
    )
    db.add(article)
    await db.flush()
    return article


async def make_entity(
    db: AsyncSession,
    *,
    name: str = "Ada Lovelace",
    entity_type: str = "PERSON",
    article: Article | None = None,
    start: int = 0,
    short_context: str | None = None,
) -> Entity:
    entity = Entity(
        canonical_name=name,
        entity_type=entity_type,
        short_context=short_context,
        popularity_score=1,
    )
    db.add(entity)
    await db.flush()
    if article is not None:
        db.add(
            ArticleEntity(
                article_id=article.id,
                entity_id=entity.id,
                mention_text=name,
                start_position=start,
                end_position=start + len(name),
                priority="high",
            )
        )
        await db.flush()
    return entity
