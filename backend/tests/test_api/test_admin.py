from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.api.deps import DEFAULT_ADMIN_SECRET
from app.config import Settings
from app.ingestion import jobs
from app.models.article import Article
from app.models.entity import ArticleEntity
from tests.factories import make_article, make_entity, make_source
from tests.fakes import make_container

ADMIN = {"X-Admin-Secret": "test-secret"}


async def test_admin_rejects_missing_or_wrong_secret(client):
    assert (await client.post("/api/v1/admin/pipeline/run")).status_code == 422
    wrong = await client.post("/api/v1/admin/pipeline/run", headers={"X-Admin-Secret": "nope"})
    assert wrong.status_code == 403


async def test_admin_rejects_default_secret_in_production(client, container):
    from app.container import get_container
    from app.main import app

    prod = make_container(Settings(admin_secret=DEFAULT_ADMIN_SECRET, environment="production"))
    app.dependency_overrides[get_container] = lambda: prod

    response = await client.post(
        "/api/v1/admin/pipeline/run", headers={"X-Admin-Secret": DEFAULT_ADMIN_SECRET}
    )

    assert response.status_code == 403


async def test_pipeline_run_schedules_ingestion(client, container):
    with patch.object(jobs, "run_ingestion", new=AsyncMock()) as run:
        response = await client.post("/api/v1/admin/pipeline/run", headers=ADMIN)
    assert response.status_code == 202
    run.assert_awaited_once_with(container)


async def test_regenerate_endpoint_schedules_job(client, container):
    with patch.object(jobs, "regenerate_summaries", new=AsyncMock()) as regen:
        response = await client.post("/api/v1/admin/summaries/regenerate", headers=ADMIN)
    assert response.status_code == 202
    regen.assert_awaited_once_with(container)


async def test_regenerate_summaries_rewrites_and_keeps_old_on_empty(container, db_session):
    async with db_session() as db:
        ok = await make_article(db, title="Ok", content="Text one.", summary="old 1")
        empty = await make_article(db, title="Empty", content="Text two.", summary="old 2")
        await db.commit()
    container.llm.replies = {"<headline>Empty</headline>": ""}
    container.llm.default = "new summary"

    updated, total = await jobs.regenerate_summaries(container)

    assert (updated, total) == (1, 2)
    async with db_session() as db:
        rows = {a.id: a.summary for a in (await db.execute(select(Article))).scalars()}
    assert rows[ok.id] == "new summary"
    assert rows[empty.id] == "old 2"


POSNER = "He was the most-cited legal scholar. Richard Posner served on the Seventh Circuit."


async def _broken_mentions(db_session) -> dict[str, object]:
    """One aligned, one misplaced (the live Posner bug) and one unlocatable mention."""
    async with db_session() as db:
        article = await make_article(db, title="Posner has died", content=POSNER)
        await make_entity(db, name="Seventh Circuit", article=article, start=66)
        await make_entity(db, name="most-cited legal scholar", article=article, start=0)
        await make_entity(db, name="Chicago school", article=article, start=0)
        await db.commit()
        return {"article": article}


async def _offsets(db_session) -> dict[str, tuple[int, int]]:
    async with db_session() as db:
        rows = (await db.execute(select(ArticleEntity))).scalars().all()
    return {m.mention_text: (m.start_position, m.end_position) for m in rows}


async def test_repair_mentions_dry_run_reports_without_writing(client, db_session):
    await _broken_mentions(db_session)
    before = await _offsets(db_session)

    response = await client.post("/api/v1/admin/mentions/repair", headers=ADMIN)

    assert response.status_code == 200
    assert response.json() == {
        "total": 3,
        "aligned": 1,
        "relocated": 1,
        "unlocatable": 1,
        "deleted": 0,
        "dry_run": True,
    }
    assert await _offsets(db_session) == before


async def test_repair_mentions_relocates_and_keeps_unlocatable_by_default(client, db_session):
    await _broken_mentions(db_session)

    response = await client.post("/api/v1/admin/mentions/repair?dry_run=false", headers=ADMIN)

    assert response.json()["relocated"] == 1
    offsets = await _offsets(db_session)
    assert offsets["most-cited legal scholar"] == (11, 35)
    assert offsets["Seventh Circuit"] == (66, 81)
    assert "Chicago school" in offsets  # not deleted without delete_unlocatable


async def test_repair_mentions_deletes_unlocatable_only_when_asked(client, db_session):
    await _broken_mentions(db_session)

    response = await client.post(
        "/api/v1/admin/mentions/repair?dry_run=false&delete_unlocatable=true", headers=ADMIN
    )

    assert response.json()["deleted"] == 1
    offsets = await _offsets(db_session)
    assert set(offsets) == {"Seventh Circuit", "most-cited legal scholar"}
    for text, (start, end) in offsets.items():
        assert POSNER[start:end] == text


async def test_repair_mentions_failure_returns_500_not_an_empty_report(client):
    with patch.object(jobs, "repair_mention_offsets", new=AsyncMock(return_value=None)):
        response = await client.post("/api/v1/admin/mentions/repair", headers=ADMIN)
    assert response.status_code == 500
    assert "nothing was changed" in response.json()["detail"]


async def test_repair_mentions_requires_admin_secret(client):
    response = await client.post(
        "/api/v1/admin/mentions/repair", headers={"X-Admin-Secret": "nope"}
    )
    assert response.status_code == 403


async def test_enrich_endpoint_schedules_job(client, container):
    with patch.object(jobs, "enrich_articles", new=AsyncMock()) as enrich:
        response = await client.post("/api/v1/admin/articles/enrich?limit=20", headers=ADMIN)
    assert response.status_code == 202
    enrich.assert_awaited_once_with(container, 20)


def _allow_page_reading(monkeypatch, feed_url: str) -> None:
    """Configure one feed whose terms allow reading article pages."""
    monkeypatch.setattr(
        "app.ingestion.pipeline.NEWS_SOURCES",
        [
            {
                "name": "T",
                "url": feed_url,
                "category": "world",
                "region": "world",
                "excerpt_words": 300,
            }
        ],
    )


async def test_enrich_articles_backfills_image_excerpt_and_rebuilds_mentions(
    container, db_session, monkeypatch
):
    from unittest.mock import AsyncMock as Mock

    from app.clients.pages import PageContent
    from app.ingestion.ner import ExtractedEntity

    async with db_session() as db:
        src = await make_source(db)
        teaser = await make_article(db, source=src, title="Teaser", content="Nvidia rose.")
        await make_entity(db, name="Nvidia", article=teaser, start=0)
        pic_only = await make_article(
            db, source=src, title="Pic only", content="Full text already here."
        )
        gone = await make_article(db, source=src, title="Gone", content="Page is down.")
        await db.commit()
    _allow_page_reading(monkeypatch, src.feed_url)
    long_text = "Shares of Nvidia rose sharply on Tuesday after earnings beat forecasts."
    container.pages.pages = {
        teaser.url: PageContent(image_url="https://cdn.test/a.jpg", text=long_text, word_count=750),
        pic_only.url: PageContent(image_url="https://cdn.test/b.jpg", text="", word_count=0),
    }
    container.llm.default = "New brief."
    found = ExtractedEntity(
        text="Nvidia",
        type="ORG",
        start=10,
        end=16,
        in_title=False,
        mention_count=1,
        priority="high",
    )
    with patch(
        "app.ingestion.ner.NERService.extract_entities_hybrid", new=Mock(return_value=[found])
    ):
        report = await jobs.enrich_articles(container, limit=10)

    assert (report.total, report.updated, report.image_only, report.unchanged) == (3, 1, 1, 1)
    async with db_session() as db:
        rows = {a.id: a for a in (await db.execute(select(Article))).scalars()}
        mentions = (
            (await db.execute(select(ArticleEntity).where(ArticleEntity.article_id == teaser.id)))
            .scalars()
            .all()
        )
    t = rows[teaser.id]
    assert (t.cleaned_content, t.image_url, t.summary, t.reading_time_minutes) == (
        long_text,
        "https://cdn.test/a.jpg",
        "New brief.",
        3,
    )
    assert [(m.mention_text, m.start_position) for m in mentions] == [("Nvidia", 10)]
    assert rows[pic_only.id].image_url == "https://cdn.test/b.jpg"
    assert rows[pic_only.id].cleaned_content == "Full text already here."
    assert rows[gone.id].image_url is None


async def test_startup_backfill_skips_finished_stories(container, db_session, monkeypatch):
    from app.clients.pages import PageContent

    async with db_session() as db:
        src = await make_source(db)
        done = await make_article(db, source=src, title="Done", content=" ".join(["word"] * 150))
        done.image_url = "https://cdn.test/done.jpg"
        teaser = await make_article(db, source=src, title="Teaser", content="Short teaser.")
        await db.commit()
    _allow_page_reading(monkeypatch, src.feed_url)
    container.pages.pages = {
        teaser.url: PageContent(
            image_url="https://cdn.test/t.jpg", text="A much longer opening. " * 20, word_count=400
        )
    }
    container.llm.default = "Brief."

    with patch(
        "app.ingestion.ner.NERService.extract_entities_hybrid", new=AsyncMock(return_value=[])
    ):
        report = await jobs.enrich_articles(container, 10, only_unfinished=True)

    assert (report.total, report.updated) == (1, 1)
    assert container.pages.calls == [teaser.url]


async def test_enrich_never_reads_pages_of_feed_only_or_unknown_outlets(container, db_session):
    from app.clients.pages import PageContent

    async with db_session() as db:
        src = await make_source(db)  # not in NEWS_SOURCES: e.g. an outlet no longer read
        teaser = await make_article(db, source=src, title="Teaser", content="Short teaser.")
        await db.commit()
    container.pages.pages = {
        teaser.url: PageContent(
            image_url="https://cdn.test/t.jpg", text="Long. " * 50, word_count=400
        )
    }

    report = await jobs.enrich_articles(container, 10)

    assert (report.total, report.unchanged) == (1, 1)
    assert container.pages.calls == []
