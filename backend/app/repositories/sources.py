"""News source queries."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.source import Source


async def get_by_feed_url(db: AsyncSession, feed_url: str) -> Source | None:
    return (
        await db.execute(select(Source).where(Source.feed_url == feed_url))
    ).scalar_one_or_none()


async def ensure(db: AsyncSession, configs: list[dict]) -> None:
    """Create a Source row for each feed config ({name, url, category}) that has none."""
    for cfg in configs:
        if await get_by_feed_url(db, cfg["url"]) is None:
            db.add(Source(name=cfg["name"], feed_url=cfg["url"], categories=[cfg["category"]]))
    await db.flush()
