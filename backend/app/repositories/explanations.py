"""Provenance records for generated explanations."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.explanation import ExplanationRecord


async def add(
    db: AsyncSession,
    *,
    entity_id: uuid.UUID,
    article_id: uuid.UUID | None,
    wikipedia_title: str | None,
    wikipedia_revision_id: int | None,
    text: str,
    model: str | None,
) -> ExplanationRecord:
    record = ExplanationRecord(
        entity_id=entity_id,
        article_id=article_id,
        wikipedia_title=wikipedia_title,
        wikipedia_revision_id=wikipedia_revision_id,
        text=text,
        model=model,
    )
    db.add(record)
    await db.flush()
    return record


async def list_for_entity(db: AsyncSession, entity_id: uuid.UUID) -> list[ExplanationRecord]:
    """Newest first."""
    return list(
        (
            await db.scalars(
                select(ExplanationRecord)
                .where(ExplanationRecord.entity_id == entity_id)
                .order_by(ExplanationRecord.generated_at.desc())
            )
        ).all()
    )
