"""End-to-end pipeline run with a fake feed, fake NER output and fake clients."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

from sqlalchemy import select

from app.database import async_session
from app.ingestion.fetcher import FetchedArticle
from app.ingestion.ner import ExtractedEntity
from app.ingestion.pipeline import IngestionPipeline
from app.models.article import Article
from app.models.entity import ArticleEntity, Entity
from app.repositories.articles import FAILED_RETRY_AFTER

SOURCE = {"name": "Test Feed", "url": "https://feeds.test/rss", "category": "tech"}


TITLES = ["Lovelace notes resurface", "Rates rise again"]
BODIES = [
    "Ada Lovelace published notes on the Analytical Engine describing an algorithm.",
    "Ada Lovelace would note that central banks raised rates as inflation stayed high.",
]


def _fetched(n: int) -> FetchedArticle:
    # Titles and bodies must differ substantially or dedup drops the second article.
    return FetchedArticle(
        title=TITLES[n - 1],
        url=f"https://news.test/story-{n}",
        raw_content=f"<p>{BODIES[n - 1]}</p>",
        published_at=datetime.now(UTC),
        author=None,
        image_url=None,
        source_name=SOURCE["name"],
        category=SOURCE["category"],
    )


def _pipeline(container, fetched: list[FetchedArticle]) -> IngestionPipeline:
    pipeline = IngestionPipeline(container, async_session, sources=[SOURCE])
    pipeline.fetcher.fetch_feed = AsyncMock(return_value=fetched)
    pipeline.ner.extract_entities_hybrid = AsyncMock(
        return_value=[
            ExtractedEntity(
                text="Ada Lovelace",
                type="PERSON",
                start=0,
                end=12,
                in_title=False,
                mention_count=1,
                priority="high",
            )
        ]
    )
    return pipeline


async def test_pipeline_stores_summarized_embedded_articles_with_entities(container):
    container.llm.default = "Claude summary."
    pipeline = _pipeline(container, [_fetched(1), _fetched(2)])

    assert await pipeline.run() == 2

    async with async_session() as db:
        articles = (await db.execute(select(Article).order_by(Article.title))).scalars().all()
        entities = (await db.execute(select(Entity))).scalars().all()
        mentions = (await db.execute(select(ArticleEntity))).scalars().all()
    assert [a.processing_status for a in articles] == ["completed", "completed"]
    assert {a.summary for a in articles} == {"Claude summary."}
    assert articles[0].categories == ["tech"]
    assert len(entities) == 1 and entities[0].popularity_score == 2  # shared across articles
    assert len(mentions) == 2
    assert len(container.vectors.upserts) == 2


async def test_pipeline_skips_urls_already_stored(container):
    pipeline = _pipeline(container, [_fetched(1)])
    assert await pipeline.run() == 1
    assert await pipeline.run() == 0


async def test_failing_article_does_not_discard_earlier_ones(container):
    pipeline = _pipeline(container, [_fetched(1), _fetched(2)])
    real = pipeline.summarizer.summarize

    async def flaky(text: str, title: str = "") -> str:
        if title == TITLES[1]:
            raise RuntimeError("boom")
        return await real(text, title=title)

    pipeline.summarizer.summarize = flaky

    assert await pipeline.run() == 1

    async with async_session() as db:
        rows = (await db.execute(select(Article).order_by(Article.title))).scalars().all()
    by_title = {a.title: a for a in rows}
    assert by_title[TITLES[0]].processing_status == "completed"
    failed = by_title[TITLES[1]]
    assert failed.processing_status == "failed"
    assert failed.processing_error == "RuntimeError: boom"
    assert failed.cleaned_content is None  # content-free: nothing to show or re-summarize


def _fail_second(pipeline: IngestionPipeline) -> AsyncMock:
    calls = AsyncMock(side_effect=RuntimeError("boom"))
    pipeline.summarizer.summarize = calls
    return calls


async def test_recently_failed_url_is_not_reprocessed_next_run(container):
    # A fresh pipeline per run, as in jobs.run_ingestion (dedup state is per run).
    first = _pipeline(container, [_fetched(1)])
    _fail_second(first)
    assert await first.run() == 0

    second = _pipeline(container, [_fetched(1)])
    calls = _fail_second(second)
    assert await second.run() == 0

    assert calls.await_count == 0  # skipped: it failed less than FAILED_RETRY_AFTER ago


async def test_failed_url_is_retried_after_the_wait_and_replaced_on_success(container):
    first = _pipeline(container, [_fetched(1)])
    _fail_second(first)
    assert await first.run() == 0

    async with async_session() as db:
        failed = (await db.execute(select(Article))).scalar_one()
        failed.updated_at = datetime.now(UTC) - FAILED_RETRY_AFTER - timedelta(minutes=1)
        await db.commit()

    container.llm.default = "Claude summary."
    assert await _pipeline(container, [_fetched(1)]).run() == 1

    async with async_session() as db:
        rows = (await db.execute(select(Article))).scalars().all()
    assert [(a.processing_status, a.summary) for a in rows] == [("completed", "Claude summary.")]


async def test_pipeline_skips_mentions_whose_offsets_miss_the_text(container):
    pipeline = _pipeline(container, [_fetched(1)])
    good = pipeline.ner.extract_entities_hybrid.return_value[0]
    bad = ExtractedEntity(
        text="Analytical Engine",
        type="CONCEPT",
        start=0,  # cleaned_content[0:17] is "Ada Lovelace publ"
        end=17,
        in_title=False,
        mention_count=1,
        priority="high",
    )
    pipeline.ner.extract_entities_hybrid.return_value = [good, bad]

    assert await pipeline.run() == 1

    async with async_session() as db:
        article = (await db.execute(select(Article))).scalar_one()
        mentions = (await db.execute(select(ArticleEntity))).scalars().all()
        names = (await db.execute(select(Entity.canonical_name))).scalars().all()
    assert [m.mention_text for m in mentions] == ["Ada Lovelace"]
    assert names == ["Ada Lovelace"]  # no entity row created for the skipped mention
    for m in mentions:
        span = article.cleaned_content[m.start_position : m.end_position]
        assert span.lower() == m.mention_text.lower()


def _feed_of(sources: list[dict], per_feed: int, age: timedelta = timedelta(hours=1)):
    def feed(source: dict) -> list[FetchedArticle]:
        return [
            FetchedArticle(
                title=f"{source['name']} story {i}",
                url=f"{source['url']}/story-{i}",
                raw_content=f"<p>Body {i} from {source['name']}.</p>",
                published_at=datetime.now(UTC) - age,
                author=None,
                image_url=None,
                source_name=source["name"],
                category=source["category"],
            )
            for i in range(per_feed)
        ]

    return feed


SOURCES = [
    {"name": f"Feed {n}", "url": f"https://feeds.test/{n}", "category": "tech", "region": "us"}
    for n in range(3)
]


def _ranked_pipeline(container, feed, max_stories: int = 3) -> IngestionPipeline:
    pipeline = IngestionPipeline(
        container, async_session, sources=SOURCES, max_stories=max_stories, target_stories=2
    )
    pipeline.ner.extract_entities_hybrid = AsyncMock(return_value=[])
    # Disable dedup: these synthetic stories are deliberately similar.
    pipeline.dedup.is_duplicate = lambda _fetched: False
    pipeline.fetcher.fetch_feed = AsyncMock(side_effect=feed)
    return pipeline


async def _stored_urls() -> list[str]:
    async with async_session() as db:
        return sorted((await db.execute(select(Article.url))).scalars().all())


async def test_only_the_ranked_picks_are_processed(container):
    # Candidates are numbered in feed order: feed 0 stories 0-2 are ids 0-2, feed 1 is 3-5...
    container.llm.replies = {
        "Candidates (9)": '{"stories": [{"id": 4, "also": [1], "offbeat": false, "why": "x"},'
        ' {"id": 8, "also": [], "offbeat": true, "why": "y"},'
        ' {"id": 1, "also": [], "offbeat": false, "why": "dup of 4"},'
        ' {"id": 99, "also": [], "why": "invented"}], "note": ""}'
    }
    pipeline = _ranked_pipeline(container, _feed_of(SOURCES, 3))

    assert await pipeline.run() == 2

    assert await _stored_urls() == [
        "https://feeds.test/1/story-1",
        "https://feeds.test/2/story-2",
    ]
    rank_calls = [c for c in container.llm.calls if "Candidates (9)" in c["prompt"]]
    assert len(rank_calls) == 1 and rank_calls[0]["effort"] == "medium"


async def test_unusable_ranking_falls_back_to_newest_across_feeds(container):
    container.llm.default = "not json"
    pipeline = _ranked_pipeline(container, _feed_of(SOURCES, 3))

    assert await pipeline.run() == 2  # the target, one per feed in turn
    assert [u.rsplit("/", 1)[0] for u in await _stored_urls()] == [
        "https://feeds.test/0",
        "https://feeds.test/1",
    ]


async def test_stories_older_than_the_window_are_not_candidates(container):
    pipeline = _ranked_pipeline(container, _feed_of(SOURCES, 2, age=timedelta(hours=30)))
    assert await pipeline.run() == 0
    assert not any("Candidates" in c["prompt"] for c in container.llm.calls)


async def test_pipeline_reads_the_article_page_for_image_excerpt_and_reading_time(container):
    from app.clients.pages import PageContent

    container.llm.default = "Claude summary."
    page_text = "Ada Lovelace wrote the first published algorithm.\n\nIt ran on paper only."
    container.pages.pages["https://news.test/story-1"] = PageContent(
        image_url="https://cdn.test/lead.jpg", text=page_text, word_count=1000
    )
    fetched = [_fetched(1), _fetched(2)]
    fetched[1].image_url = "https://cdn.test/feed-thumb.jpg"
    pipeline = _pipeline(container, fetched)

    assert await pipeline.run() == 2

    async with async_session() as db:
        rows = {a.url: a for a in (await db.execute(select(Article))).scalars()}
    one, two = rows["https://news.test/story-1"], rows["https://news.test/story-2"]
    assert (one.image_url, one.cleaned_content, one.reading_time_minutes) == (
        "https://cdn.test/lead.jpg",
        page_text,
        4,
    )
    # Unreadable page: the feed's teaser and image stay.
    assert two.image_url == "https://cdn.test/feed-thumb.jpg"
    assert two.cleaned_content == BODIES[1]
    assert container.pages.calls == ["https://news.test/story-1", "https://news.test/story-2"]


async def test_blocked_publishers_feeds_and_items_are_skipped(container):
    container.settings.blocked_publishers = "news.test, feeds.blocked.test"
    pipeline = _pipeline(container, [_fetched(1)])
    blocked_feed = {"name": "Blocked", "url": "https://feeds.blocked.test/rss", "category": "tech"}
    pipeline_with_blocked_feed = IngestionPipeline(
        container, async_session, sources=[SOURCE, blocked_feed]
    )

    assert await pipeline.run() == 0  # the item's URL is on news.test
    assert pipeline_with_blocked_feed.sources == [SOURCE]
