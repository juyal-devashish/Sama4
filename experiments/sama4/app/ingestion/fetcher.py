import logging
from dataclasses import dataclass
from datetime import datetime

import feedparser
import httpx

logger = logging.getLogger(__name__)


@dataclass
class FetchedArticle:
    """Raw article data from an RSS feed."""

    url: str
    title: str
    raw_content: str
    image_url: str | None
    author: str | None
    published_at: datetime | None
    source_name: str
    category: str


class FetcherService:
    """Fetches articles from RSS feeds."""

    async def fetch_feed(self, source: dict) -> list[FetchedArticle]:
        """Fetch and parse articles from a single RSS feed.

        Args:
            source: Source config dict with name, url, category.

        Returns:
            List of fetched articles.
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(source["url"])
                response.raise_for_status()
        except httpx.HTTPError:
            logger.error(f"Failed to fetch feed: {source['name']}")
            return []

        feed = feedparser.parse(response.text)
        articles = []

        for entry in feed.entries:
            published = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                published = datetime(*entry.published_parsed[:6])

            # Try to get image
            image_url = None
            if hasattr(entry, "media_content") and entry.media_content:
                image_url = entry.media_content[0].get("url")
            elif hasattr(entry, "enclosures") and entry.enclosures:
                image_url = entry.enclosures[0].get("href")

            articles.append(
                FetchedArticle(
                    url=entry.get("link", ""),
                    title=entry.get("title", ""),
                    raw_content=entry.get("summary", ""),
                    image_url=image_url,
                    author=entry.get("author"),
                    published_at=published,
                    source_name=source["name"],
                    category=source["category"],
                )
            )

        logger.info(f"Fetched {len(articles)} articles from {source['name']}")
        return articles
