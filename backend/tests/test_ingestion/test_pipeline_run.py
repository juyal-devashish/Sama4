"""End-to-end pipeline run with a fake feed, fake NER output and fake clients."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

from sqlalchemy import select

from app.database import async_session
from app.ingestion.fetcher import FetchedArticle
from app.ingestion.ner import ExtractedEntity
from app.ingestion.pipeline import IngestionPipeline
from app.models.article import Article
from app.models.entity import ArticleEntity, Entity

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
        titles = (await db.execute(select(Article.title))).scalars().all()
    assert titles == [TITLES[0]]


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
