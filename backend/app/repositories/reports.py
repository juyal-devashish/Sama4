"""Explanation error reports."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import ExplanationReport


async def add(
    db: AsyncSession,
    *,
    entity_id: uuid.UUID,
    entity_name: str,
    article_id: uuid.UUID | None,
    explanation_text: str,
    reason: str,
    note: str | None,
) -> ExplanationReport:
    report = ExplanationReport(
        entity_id=entity_id,
        entity_name=entity_name,
        article_id=article_id,
        explanation_text=explanation_text,
        reason=reason,
        note=note,
    )
    db.add(report)
    await db.flush()
    return report


async def list_recent(
    db: AsyncSession, *, status: str | None = "open", limit: int = 100
) -> list[ExplanationReport]:
    """Newest first; `status=None` returns every status."""
    query = select(ExplanationReport).order_by(ExplanationReport.created_at.desc()).limit(limit)
    if status is not None:
        query = query.where(ExplanationReport.status == status)
    return list((await db.scalars(query)).all())
