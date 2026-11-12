"""Tests for the admin summary-regeneration endpoint and task."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.config import settings
from app.database import async_session, create_tables
from app.models.article import Article
from app.routers.admin import _regenerate_summaries


@pytest.mark.asyncio
async def test_regenerate_rejects_wrong_secret(client):
    response = await client.post(
        "/api/v1/admin/summaries/regenerate", headers={"X-Admin-Secret": "wrong"}
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_regenerate_accepts_valid_secret(client):
    with patch("app.routers.admin._regenerate_summaries", new=AsyncMock()) as task:
        response = await client.post(
            "/api/v1/admin/summaries/regenerate",
            headers={"X-Admin-Secret": settings.admin_secret},
        )
    assert response.status_code == 202
    task.assert_awaited_once()


@pytest.mark.asyncio
async def test_regenerate_rewrites_summaries_and_keeps_old_on_empty():
    await create_tables()
    tag = uuid.uuid4().hex
    ok = Article(url=f"https://x/{tag}/1", title="Ok", cleaned_content="Text one.", summary="old 1")
    empty = Article(url=f"https://x/{tag}/2", title="Empty", cleaned_content="Text two.", summary="old 2")
    async with async_session() as db:
        db.add_all([ok, empty])
        await db.commit()
        ok_id, empty_id = ok.id, empty.id

    async def fake_summarize(self, text: str, title: str = "") -> str:
        return "" if title == "Empty" else f"new summary for {title}"

    with patch("app.ingestion.summarizer.SummarizerService.summarize", new=fake_summarize), patch(
        "app.ingestion.summarizer.LLMService"
    ):
        await _regenerate_summaries()

    async with async_session() as db:
        rows = {
            a.id: a.summary
            for a in (
                await db.execute(select(Article).where(Article.id.in_([ok_id, empty_id])))
            ).scalars()
        }
    assert rows[ok_id] == "new summary for Ok"
    assert rows[empty_id] == "old 2"
