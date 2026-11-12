"""Prediction lifecycle: runs that die with the process must not stay "running" forever."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.ingestion.jobs import fail_interrupted_predictions
from app.models.prediction import (
    STATUS_COMPLETED,
    STATUS_FAILED,
    STATUS_QUEUED,
    STATUS_SIMULATING,
    Prediction,
)
from tests.factories import make_article

LONG_AGO = datetime.now(UTC) - timedelta(hours=3)


async def _prediction(db_session, status: str, updated_at: datetime | None = None) -> Prediction:
    async with db_session() as db:
        article = await make_article(db)
        prediction = Prediction(article_id=article.id, status=status)
        if updated_at is not None:
            prediction.created_at = updated_at
            prediction.updated_at = updated_at
        db.add(prediction)
        await db.commit()
        return prediction


async def _status(db_session, prediction_id) -> str:
    async with db_session() as db:
        return (await db.get(Prediction, prediction_id)).status


async def test_status_endpoint_fails_a_run_that_stopped_progressing(client, db_session):
    stale = await _prediction(db_session, STATUS_SIMULATING, updated_at=LONG_AGO)

    res = await client.get(f"/api/v1/predictions/{stale.id}/status")

    assert res.status_code == 200
    assert res.json()["status"] == STATUS_FAILED
    assert await _status(db_session, stale.id) == STATUS_FAILED


async def test_status_endpoint_leaves_a_live_run_alone(client, db_session):
    live = await _prediction(db_session, STATUS_SIMULATING)

    res = await client.get(f"/api/v1/predictions/{live.id}/status")

    assert res.json()["status"] == STATUS_SIMULATING


async def test_article_endpoint_reports_a_stale_run_as_failed(client, db_session):
    stale = await _prediction(db_session, STATUS_QUEUED, updated_at=LONG_AGO)

    res = await client.get(f"/api/v1/predictions/article/{stale.article_id}")

    assert res.json()["status"] == STATUS_FAILED


async def test_simulate_replaces_a_stale_run_instead_of_returning_it(client, db_session):
    stale = await _prediction(db_session, STATUS_SIMULATING, updated_at=LONG_AGO)

    res = await client.post(
        "/api/v1/predictions/simulate", json={"article_id": str(stale.article_id)}
    )

    assert res.status_code == 200
    assert res.json()["id"] != str(stale.id)
    assert await _status(db_session, stale.id) == STATUS_FAILED


async def test_startup_cleanup_fails_running_runs_and_keeps_finished_ones(db_session):
    running = await _prediction(db_session, STATUS_SIMULATING)
    done = await _prediction(db_session, STATUS_COMPLETED)

    assert await fail_interrupted_predictions() == 1

    assert await _status(db_session, running.id) == STATUS_FAILED
    assert await _status(db_session, done.id) == STATUS_COMPLETED
    async with db_session() as db:
        msg = (
            await db.execute(select(Prediction.error_message).where(Prediction.id == running.id))
        ).scalar_one()
    assert "restart" in msg
