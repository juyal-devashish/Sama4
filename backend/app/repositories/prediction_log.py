"""The permanent log of published projections (see models/prediction_log.py)."""

import json
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.prediction import Prediction
from app.models.prediction_log import PredictionLogEntry


async def record(
    db: AsyncSession,
    prediction: Prediction,
    *,
    resolve_after_days: int,
    model: str | None,
) -> PredictionLogEntry | None:
    """Log a finished projection once (re-running a completion never duplicates it)."""
    existing = await db.scalar(
        select(PredictionLogEntry).where(PredictionLogEntry.prediction_id == prediction.id)
    )
    if existing is not None:
        return existing
    article = await db.get(Article, prediction.article_id)
    predicted_at = prediction.completed_at or datetime.now(UTC)
    entry = PredictionLogEntry(
        prediction_id=prediction.id,
        article_id=prediction.article_id,
        article_title=(article.title if article else "")[:1000],
        article_url=(article.url if article else "")[:2000],
        method=prediction.method,
        model=model,
        summary=prediction.prediction_summary or "",
        outcomes=json.dumps(list(prediction.predicted_outcomes or [])),
        predicted_at=predicted_at,
        resolve_by=predicted_at + timedelta(days=resolve_after_days),
    )
    db.add(entry)
    await db.flush()
    return entry


async def list_recent(
    db: AsyncSession, *, resolution: str | None = None, limit: int = 100
) -> list[PredictionLogEntry]:
    """Newest first; `resolution=None` returns every state."""
    query = select(PredictionLogEntry).order_by(PredictionLogEntry.predicted_at.desc())
    if resolution is not None:
        query = query.where(PredictionLogEntry.resolution == resolution)
    return list((await db.scalars(query.limit(limit))).all())


async def get(db: AsyncSession, entry_id: uuid.UUID) -> PredictionLogEntry | None:
    return await db.get(PredictionLogEntry, entry_id)
