"""Ingestion pipeline: fetch -> dedup -> clean -> NER -> link -> summarize -> embed -> store.

Each source runs in its own DB session so one bad feed can't break the others,
and each article in its own try/except so one bad article can't break its feed.
"""

import logging
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.container import Container
from app.ingestion.cleaner import CleanerService
from app.ingestion.dedup import DeduplicationService
from app.ingestion.fetcher import FetchedArticle, FetcherService
from app.ingestion.linker import EntityLinker
from app.ingestion.ner import NERService, is_aligned
from app.ingestion.sources import NEWS_SOURCES
from app.ingestion.summarizer import SummarizerService
from app.models.article import Article
from app.models.entity import ArticleEntity
from app.models.source import Source
from app.repositories import articles as article_repo
from app.repositories import entities as entity_repo
from app.repositories import sources as source_repo

logger = logging.getLogger(__name__)


class IngestionPipeline:
    def __init__(
        self,
        container: Container,
        session_factory: async_sessionmaker[AsyncSession],
        sources: list[dict] | None = None,
        max_articles: int = 0,
    ) -> None:
        self.session_factory = session_factory
        self.sources = sources if sources is not None else NEWS_SOURCES
        # Cap on articles attempted per run (successes and failures both cost API calls).
        self.max_articles = max_articles
        self.vectors = container.vectors
        self.fetcher = FetcherService()
        self.dedup = DeduplicationService()
        self.cleaner = CleanerService()
        self.ner = NERService(llm=container.llm)
        self.linker = EntityLinker(container.wikimedia)
        self.summarizer = SummarizerService(container.llm)

    async def run(self) -> int:
        """Run every source once. Returns the number of new articles stored."""
        logger.info("Starting ingestion pipeline")
        async with self.session_factory() as db:
            await source_repo.ensure(db, self.sources)
            await db.commit()

        processed = 0
        remaining = self.max_articles
        for i, source_config in enumerate(self.sources):
            # Split what's left of the budget evenly over the sources still to run,
            # so a capped run samples every feed instead of draining the first one.
            limit = None
            if self.max_articles > 0:
                if remaining <= 0:
                    break
                limit = -(-remaining // (len(self.sources) - i))  # ceil division
            try:
                async with self.session_factory() as db:
                    stored, attempted = await self._process_source(source_config, db, limit)
                    processed += stored
                    remaining -= attempted
                    await db.commit()
            except Exception:
                logger.error("Failed to process source: %s", source_config["name"], exc_info=True)

        logger.info("Ingestion pipeline complete. Processed %d articles.", processed)
        return processed

    async def _process_source(
        self, source_config: dict, db: AsyncSession, limit: int | None = None
    ) -> tuple[int, int]:
        """Process one feed. Returns (articles stored, articles attempted)."""
        source = await source_repo.get_by_feed_url(db, source_config["url"])
        if source is None:
            raise RuntimeError(f"Source row missing for {source_config['url']}")

        processed = attempted = 0
        category = source_config["category"]
        for fetched in await self.fetcher.fetch_feed(source_config):
            if limit is not None and attempted >= limit:
                break
            if self.dedup.is_duplicate(fetched):
                continue
            existing = await article_repo.get_by_url(db, fetched.url)
            if existing is not None and not article_repo.due_for_retry(existing):
                continue  # already stored, or failed recently
            attempted += 1
            try:
                # Savepoint: a failing article is rolled back alone; earlier ones are kept.
                async with db.begin_nested():
                    if existing is not None:  # retrying: replace the "failed" row
                        await db.delete(existing)
                        await db.flush()
                    await self._process_article(fetched, source, category, db)
                processed += 1
            except Exception as exc:
                logger.error("Failed to process article: %s", fetched.url, exc_info=True)
                try:
                    async with db.begin_nested():
                        await article_repo.record_failure(
                            db,
                            url=fetched.url,
                            title=fetched.title,
                            source_id=source.id,
                            category=category,
                            published_at=fetched.published_at,
                            error=f"{type(exc).__name__}: {exc}",
                        )
                except Exception:
                    logger.error("Could not record failure for %s", fetched.url, exc_info=True)

        source.last_fetched_at = datetime.now(UTC)
        return processed, attempted

    async def _process_article(
        self, fetched: FetchedArticle, source: Source, category: str, db: AsyncSession
    ) -> None:
        cleaned = self.cleaner.clean(fetched.raw_content)
        article = Article(
            source_id=source.id,
            url=fetched.url,
            title=fetched.title,
            raw_content=fetched.raw_content,
            image_url=fetched.image_url,
            author=fetched.author,
            published_at=fetched.published_at,
            cleaned_content=cleaned,
            content_hash=self.cleaner.compute_hash(cleaned),
            reading_time_minutes=self.cleaner.estimate_reading_time(cleaned),
            categories=[category],
            processing_status="processing",
        )
        db.add(article)
        await db.flush()

        try:
            extracted = await self.ner.extract_entities_hybrid(
                cleaned, fetched.title, categories=[category]
            )
            for linked in await self.linker.link_entities(extracted):
                # The reader highlights cleaned_content[start:end]; never store a miss.
                if not is_aligned(cleaned, linked.text, linked.start, linked.end):
                    logger.warning(
                        "Skipping misaligned mention %r at %d:%d in %s",
                        linked.text,
                        linked.start,
                        linked.end,
                        article.url,
                    )
                    continue
                entity = await entity_repo.get_or_create(
                    db,
                    name=linked.text,
                    entity_type=linked.type,
                    wikidata_id=linked.wikidata_id,
                    wikipedia_url=linked.wikipedia_url,
                    short_context=linked.description,
                )
                entity.popularity_score = (entity.popularity_score or 0) + 1
                db.add(
                    ArticleEntity(
                        article_id=article.id,
                        entity_id=entity.id,
                        mention_text=linked.text,
                        start_position=linked.start,
                        end_position=linked.end,
                        priority=linked.priority,
                        in_title=linked.in_title,
                    )
                )

            if cleaned:
                article.summary = await self.summarizer.summarize(cleaned, title=article.title)

            await self.vectors.upsert_article(
                article_id=article.id,
                title=article.title,
                summary=article.summary or "",
                source=source.name,
                categories=article.categories or [],
                published_at=article.published_at.isoformat() if article.published_at else None,
            )
            article.processing_status = article_repo.STATUS_COMPLETED
        except Exception:
            # The caller's savepoint rolls this row back and stores a "failed" row instead.
            logger.error("Pipeline failed for article: %s", article.url, exc_info=True)
            raise
