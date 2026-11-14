"""Ingestion pipeline: fetch -> pick -> read page -> NER -> link -> summarize -> embed -> store.

A run fetches every feed, keeps the fresh items not stored yet (published in the last
`window_hours`, deduplicated), and asks the ranker to pick the day's stories. Only the
picks go through the costly steps. Each article is processed in its own savepoint, so
one bad article is recorded as failed without losing the others.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.clients.pages import PageContent, excerpt
from app.container import Container
from app.ingestion.blocklist import allowed_sources, is_blocked, parse_domains
from app.ingestion.cleaner import CleanerService
from app.ingestion.dedup import DeduplicationService
from app.ingestion.fetcher import FetchedArticle, FetcherService
from app.ingestion.linker import EntityLinker
from app.ingestion.ner import NERService, is_aligned
from app.ingestion.ranker import Candidate, StoryRanker
from app.ingestion.sources import NEWS_SOURCES, excerpt_limit
from app.ingestion.summarizer import SummarizerService
from app.models.article import Article
from app.models.entity import ArticleEntity
from app.models.source import Source
from app.repositories import articles as article_repo
from app.repositories import entities as entity_repo
from app.repositories import sources as source_repo

logger = logging.getLogger(__name__)

# A feed may be a little ahead of our clock; anything further in the future is bad data.
FUTURE_SLACK = timedelta(hours=1)


def _utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


class IngestionPipeline:
    def __init__(
        self,
        container: Container,
        session_factory: async_sessionmaker[AsyncSession],
        sources: list[dict] | None = None,
        *,
        max_stories: int = 0,
        target_stories: int = 12,
        window_hours: int = 24,
    ) -> None:
        """`max_stories` > 0 ranks candidates and processes at most that many;
        0 processes every fresh candidate (tests, backfills)."""
        self.session_factory = session_factory
        self.blocked = parse_domains(container.settings.blocked_publishers)
        self.sources = allowed_sources(
            sources if sources is not None else NEWS_SOURCES, self.blocked
        )
        self.by_feed_url = {s["url"]: s for s in self.sources}
        self.max_stories = max_stories
        self.window = timedelta(hours=window_hours) if window_hours > 0 else None
        self.vectors = container.vectors
        self.pages = container.pages
        self.fetcher = FetcherService()
        self.dedup = DeduplicationService()
        self.cleaner = CleanerService()
        self.ner = NERService(llm=container.llm)
        self.linker = EntityLinker(container.wikimedia)
        self.summarizer = SummarizerService(container.llm)
        self.ranker = StoryRanker(
            container.llm,
            target=min(target_stories, max_stories or target_stories),
            maximum=max_stories or target_stories,
        )

    async def run(self) -> int:
        """Run once. Returns the number of new articles stored."""
        logger.info("Starting ingestion pipeline")
        async with self.session_factory() as db:
            await source_repo.ensure(db, self.sources)
            await db.commit()

        candidates = await self._collect()
        if self.max_stories > 0:
            selection = await self.ranker.select(candidates)
            chosen = [p.candidate for p in selection.picks]
            logger.info(
                "Ranked %d candidates; chose %d%s",
                len(candidates),
                len(chosen),
                f" ({selection.note})" if selection.note else "",
            )
        else:
            chosen = candidates

        processed = 0
        for candidate in chosen:
            try:
                async with self.session_factory() as db:
                    processed += await self._store(candidate, db)
                    await db.commit()
            except Exception:
                logger.error("Failed to store %s", candidate.fetched.url, exc_info=True)

        logger.info("Ingestion pipeline complete. Processed %d articles.", processed)
        return processed

    async def _collect(self) -> list[Candidate]:
        """Every fresh, unseen item across all feeds, in feed order."""
        feeds = await asyncio.gather(
            *(self.fetcher.fetch_feed(src) for src in self.sources), return_exceptions=True
        )
        now = datetime.now(UTC)
        candidates: list[Candidate] = []
        seen_urls: set[str] = set()
        async with self.session_factory() as db:
            for src, items in zip(self.sources, feeds, strict=True):
                if isinstance(items, BaseException):
                    logger.error("Failed to fetch %s: %s", src["name"], items)
                    continue
                for fetched in items:
                    if not fetched.url or fetched.url in seen_urls:
                        continue
                    if is_blocked(fetched.url, self.blocked):
                        continue  # publisher opted out
                    if self.window is not None:
                        if fetched.published_at is None:
                            continue  # can't tell if it's from today
                        published = _utc(fetched.published_at)
                        if published < now - self.window or published > now + FUTURE_SLACK:
                            continue
                    if self.dedup.is_duplicate(fetched):
                        continue
                    existing = await article_repo.get_by_url(db, fetched.url)
                    if existing is not None and not article_repo.due_for_retry(existing):
                        continue  # already stored, or failed recently
                    seen_urls.add(fetched.url)
                    candidates.append(Candidate(fetched=fetched, source=src))
                source = await source_repo.get_by_feed_url(db, src["url"])
                if source is not None:
                    source.last_fetched_at = now
            await db.commit()
        return candidates

    async def _store(self, candidate: Candidate, db: AsyncSession) -> int:
        """Process and store one picked story. Returns 1 if stored, 0 if it failed."""
        fetched, src = candidate.fetched, candidate.source
        source = await source_repo.get_by_feed_url(db, src["url"])
        if source is None:
            raise RuntimeError(f"Source row missing for {src['url']}")
        category = src["category"]
        existing = await article_repo.get_by_url(db, fetched.url)
        try:
            # Savepoint: a failing article is rolled back alone.
            async with db.begin_nested():
                if existing is not None:  # retrying: replace the "failed" row
                    await db.delete(existing)
                    await db.flush()
                await self._process_article(fetched, source, category, db, excerpt_limit(src))
            return 1
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
            return 0

    def _text_and_image(
        self, fetched_text: str, fetched_image: str | None, page: PageContent | None
    ) -> tuple[str, str | None, int | None]:
        """The excerpt to store, the lead image and the reading time of the full article.

        The page's opening paragraphs win when they say more than the feed's teaser; the
        page's lead image wins over the feed's (usually a small thumbnail). Without the
        page the article's length is unknown, so there's no reading time.
        """
        feed_text = excerpt([fetched_text]) if fetched_text else ""
        text = feed_text
        if page and len(page.text.split()) > len(feed_text.split()):
            text = page.text
        image = (page.image_url if page else None) or fetched_image
        if page is None:
            return text, image, None
        full_words = max(page.word_count, len(fetched_text.split()))
        return text, image, max(1, round(full_words / 250))

    async def _read_page(self, url: str, max_words: int) -> PageContent | None:
        """The article page, only when the outlet's terms allow showing its text."""
        if max_words <= 0:
            return None
        return await self.pages.fetch(url, max_words)

    async def _process_article(
        self,
        fetched: FetchedArticle,
        source: Source,
        category: str,
        db: AsyncSession,
        max_words: int = 0,
    ) -> None:
        page = await self._read_page(fetched.url, max_words)
        cleaned, image, minutes = self._text_and_image(
            self.cleaner.clean(fetched.raw_content), fetched.image_url, page
        )
        article = Article(
            source_id=source.id,
            url=fetched.url,
            title=fetched.title,
            raw_content=fetched.raw_content,
            image_url=image,
            author=fetched.author,
            published_at=fetched.published_at,
            cleaned_content=cleaned,
            content_hash=self.cleaner.compute_hash(cleaned),
            reading_time_minutes=minutes,
            categories=[category],
            processing_status="processing",
        )
        db.add(article)
        await db.flush()

        try:
            await self._annotate(article, source, db)
            article.processing_status = article_repo.STATUS_COMPLETED
        except Exception:
            # The caller's savepoint rolls this row back and stores a "failed" row instead.
            logger.error("Pipeline failed for article: %s", article.url, exc_info=True)
            raise

    async def enrich(self, article: Article, source: Source | None, db: AsyncSession) -> str:
        """Backfill a stored article from its page: lead image, excerpt, terms, summary.

        Returns "updated", "image" (only the image changed) or "unchanged". When the text
        changes, its mentions are rebuilt, since their offsets point into the old text.
        """
        config = self.by_feed_url.get(source.feed_url) if source else None
        page = await self._read_page(article.url, excerpt_limit(config))
        if page is None:
            return "unchanged"
        current = article.cleaned_content or ""
        text, image, minutes = self._text_and_image(current, article.image_url, page)
        image_changed = bool(image) and image != article.image_url
        if image_changed:
            article.image_url = image
        if text == current or not page.text:
            return "image" if image_changed else "unchanged"

        article.cleaned_content = text
        article.content_hash = self.cleaner.compute_hash(text)
        article.reading_time_minutes = minutes
        await article_repo.delete_mentions(db, article.id)
        await self._annotate(article, source, db)
        return "updated"

    async def _annotate(self, article: Article, source: Source | None, db: AsyncSession) -> None:
        """Find and link the terms, summarize and embed. Raises on failure."""
        cleaned = article.cleaned_content or ""
        categories = article.categories or []
        extracted = await self.ner.extract_entities_hybrid(
            cleaned, article.title, categories=categories
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
            source=source.name if source else "",
            categories=categories,
            published_at=article.published_at.isoformat() if article.published_at else None,
        )
