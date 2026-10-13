import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.ingestion.cleaner import CleanerService
from app.ingestion.dedup import DeduplicationService
from app.ingestion.embedder import ArticleEmbedder
from app.ingestion.fetcher import FetcherService
from app.ingestion.linker import EntityLinker
from app.ingestion.ner import NERService
from app.ingestion.sources import NEWS_SOURCES
from app.ingestion.summarizer import SummarizerService
from app.models.article import Article
from app.models.entity import ArticleEntity, Entity
from app.models.source import Source

logger = logging.getLogger(__name__)


class IngestionPipeline:
    """Orchestrates the full ingestion pipeline.

    fetch -> dedup -> clean -> NER -> link -> summarize -> embed -> store.
    """

    def __init__(self) -> None:
        self.fetcher = FetcherService()
        self.dedup = DeduplicationService()
        self.cleaner = CleanerService()
        self.ner = NERService()
        self.linker = EntityLinker()
        self.summarizer = SummarizerService()
        self.embedder = ArticleEmbedder()

    async def run(self) -> int:
        """Run the full ingestion pipeline.

        Returns:
            Number of articles processed.
        """
        logger.info("Starting ingestion pipeline")
        processed = 0

        # Ensure sources exist in their own session
        async with async_session() as db:
            await self._ensure_sources(db)
            await db.commit()

        # Process each source in its own session to isolate failures
        for source_config in NEWS_SOURCES:
            try:
                async with async_session() as db:
                    count = await self._process_source(source_config, db)
                    await db.commit()
                    processed += count
            except Exception:
                logger.error(
                    f"Failed to process source: {source_config['name']}",
                    exc_info=True,
                )

        logger.info(f"Ingestion pipeline complete. Processed {processed} articles.")
        return processed

    async def _ensure_sources(self, db: AsyncSession) -> None:
        """Create source records if they don't exist."""
        for src in NEWS_SOURCES:
            result = await db.execute(select(Source).where(Source.feed_url == src["url"]))
            if not result.scalar_one_or_none():
                db.add(
                    Source(
                        name=src["name"],
                        feed_url=src["url"],
                        categories=[src["category"]],
                    )
                )
        await db.flush()

    async def _process_source(self, source_config: dict, db: AsyncSession) -> int:
        """Process a single news source."""
        # Fetch articles
        fetched = await self.fetcher.fetch_feed(source_config)
        processed = 0

        for article_data in fetched:
            # Skip duplicates
            if self.dedup.is_duplicate(article_data):
                continue

            # Check if URL already exists
            existing = await db.execute(select(Article).where(Article.url == article_data.url))
            if existing.scalar_one_or_none():
                continue

            try:
                await self._process_article(article_data, source_config, db)
                await db.flush()
                processed += 1
            except Exception:
                logger.error(f"Failed to process article: {article_data.url}", exc_info=True)
                await db.rollback()

        # Update source last_fetched_at
        source_result = await db.execute(
            select(Source).where(Source.feed_url == source_config["url"])
        )
        source = source_result.scalar_one_or_none()
        if source:
            source.last_fetched_at = datetime.now(UTC)

        return processed

    async def _process_article(self, article_data, source_config: dict, db: AsyncSession) -> None:
        """Process a single article through the full pipeline."""
        # Get source
        source_result = await db.execute(
            select(Source).where(Source.feed_url == source_config["url"])
        )
        source = source_result.scalar_one()

        # Clean content
        cleaned = self.cleaner.clean(article_data.raw_content)
        content_hash = self.cleaner.compute_hash(cleaned)
        reading_time = self.cleaner.estimate_reading_time(cleaned)

        # Create article record
        article = Article(
            source_id=source.id,
            url=article_data.url,
            title=article_data.title,
            raw_content=article_data.raw_content,
            image_url=article_data.image_url,
            author=article_data.author,
            published_at=article_data.published_at,
            cleaned_content=cleaned,
            content_hash=content_hash,
            reading_time_minutes=reading_time,
            categories=[source_config["category"]],
            processing_status="processing",
        )
        db.add(article)
        await db.flush()

        try:
            # NER — hybrid: spaCy structural entities + LLM knowledge-gap detection
            entities = await self.ner.extract_entities_hybrid(
                cleaned, article_data.title, categories=[source_config["category"]]
            )

            # Entity linking
            linked = await self.linker.link_entities(entities)

            # Store entities
            for le in linked:
                # Upsert entity
                entity_result = await db.execute(
                    select(Entity).where(
                        Entity.canonical_name == le.text,
                        Entity.entity_type == le.type,
                    )
                )
                entity = entity_result.scalar_one_or_none()
                if not entity:
                    entity = Entity(
                        canonical_name=le.text,
                        entity_type=le.type,
                        wikidata_id=le.wikidata_id,
                        wikipedia_url=le.wikipedia_url,
                        short_context=le.description,
                    )
                    db.add(entity)
                    await db.flush()

                entity.popularity_score += 1

                # Create article-entity mapping
                db.add(
                    ArticleEntity(
                        article_id=article.id,
                        entity_id=entity.id,
                        mention_text=le.text,
                        start_position=le.start,
                        end_position=le.end,
                        priority=le.priority,
                        in_title=le.in_title,
                    )
                )

            # Summarize
            if cleaned:
                article.summary = await self.summarizer.summarize(cleaned)

            # Embed
            await self.embedder.embed_article(
                article_id=str(article.id),
                title=article.title,
                summary=article.summary or "",
                categories=article.categories or [],
                source=source.name,
                published_at=article.published_at.isoformat() if article.published_at else None,
            )

            article.processing_status = "completed"
        except Exception:
            article.processing_status = "failed"
            logger.error(f"Pipeline failed for article: {article.url}", exc_info=True)
            raise
