from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.api.deps import DEFAULT_ADMIN_SECRET
from app.config import Settings
from app.ingestion import jobs
from app.models.article import Article
from app.models.entity import ArticleEntity
from tests.factories import make_article, make_entity
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
