"""Prediction queries."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prediction import Prediction


async def latest_completed_for_article(
    db: AsyncSession, article_id: uuid.UUID
) -> Prediction | None:
    return (
        await db.execute(
            select(Prediction)
            .where(Prediction.article_id == article_id, Prediction.status == "completed")
            .limit(1)
        )
    ).scalar_one_or_none()
