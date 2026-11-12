from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.api.deps import DEFAULT_ADMIN_SECRET
from app.config import Settings
from app.ingestion import jobs
from app.models.article import Article
from tests.factories import make_article
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
