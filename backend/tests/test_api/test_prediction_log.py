"""Every published projection is logged with a timestamp and a date to check it by."""

import json
from datetime import timedelta

from sqlalchemy import select

from app.ingestion.jobs import run_simulation
from app.models.article import Article
from app.models.prediction import STATUS_FAILED, STATUS_QUEUED, Prediction
from app.models.prediction_log import PredictionLogEntry
from tests.test_api.test_predictions import _prediction

ADMIN = {"X-Admin-Secret": "test-secret"}
REPLY = json.dumps(
    {
        "prediction_summary": "Rates will likely fall by spring.",
        "predicted_outcomes": ["Rates fall", "Rates hold"],
        "agent_perspectives": [{"agent_name": "A", "perspective_text": "B"}],
    }
)


async def _entries(db_session) -> list[PredictionLogEntry]:
    async with db_session() as db:
        return list((await db.scalars(select(PredictionLogEntry))).all())


async def test_a_finished_projection_is_logged_once_with_a_resolve_date(container, db_session):
    queued = await _prediction(db_session, STATUS_QUEUED)
    container.llm.default = REPLY

    await run_simulation(container, str(queued.id))

    [entry] = await _entries(db_session)
    assert entry.prediction_id == queued.id
    assert entry.summary == "Rates will likely fall by spring."
    assert json.loads(entry.outcomes) == ["Rates fall", "Rates hold"]
    assert entry.method == "language_model"
    assert entry.resolution == "pending"
    assert entry.resolve_by - entry.predicted_at == timedelta(
        days=container.settings.prediction_resolve_days
    )


async def test_a_cancelled_run_is_not_logged(container, db_session):
    queued = await _prediction(db_session, STATUS_QUEUED)

    async def generate_then_get_cancelled(prompt, **kwargs):
        async with db_session() as db:
            row = await db.get(Prediction, queued.id)
            row.status, row.error_message = STATUS_FAILED, "Cancelled by the reader."
            await db.commit()
        return REPLY

    container.llm.generate = generate_then_get_cancelled
    await run_simulation(container, str(queued.id))

    assert await _entries(db_session) == []


async def test_the_log_outlives_the_story_and_is_listed_for_admins(client, container, db_session):
    queued = await _prediction(db_session, STATUS_QUEUED)
    container.llm.default = REPLY
    await run_simulation(container, str(queued.id))
    async with db_session() as db:  # e.g. a publisher opt-out deletes the story
        await db.delete(await db.get(Article, queued.article_id))
        await db.commit()

    listed = (await client.get("/api/v1/admin/predictions/log", headers=ADMIN)).json()
    pending = (
        await client.get("/api/v1/admin/predictions/log?resolution=pending", headers=ADMIN)
    ).json()
    resolved = (
        await client.get("/api/v1/admin/predictions/log?resolution=happened", headers=ADMIN)
    ).json()

    assert [e["summary"] for e in listed] == ["Rates will likely fall by spring."]
    assert listed[0]["outcomes"] == ["Rates fall", "Rates hold"]
    assert listed[0]["article_title"]  # the title was copied at the time
    assert len(pending) == 1 and resolved == []


async def test_the_log_needs_the_admin_secret(client):
    wrong = await client.get("/api/v1/admin/predictions/log", headers={"X-Admin-Secret": "nope"})
    assert wrong.status_code == 403


# --- Private individuals: no outlook about them (item 61) -------------------------------


async def _queued_for(db_session, title: str, *, people: list[tuple[str, str | None]]):
    from tests.factories import make_article, make_entity

    async with db_session() as db:
        article = await make_article(db, title=title)
        for name, wiki in people:
            await make_entity(db, name=name, article=article, wikipedia_url=wiki)
        prediction = Prediction(article_id=article.id, status=STATUS_QUEUED)
        db.add(prediction)
        await db.commit()
        return prediction


async def test_an_outlook_about_a_private_individual_is_declined(client, container, db_session):
    queued = await _queued_for(
        db_session, "Neighbour charged after dispute", people=[("Dana Roe", None)]
    )
    container.llm.default = REPLY
    container.llm.replies = {"PRIVATE-INDIVIDUAL CHECK": '{"private_subject": true}'}

    await run_simulation(container, str(queued.id))

    detail = (await client.get(f"/api/v1/predictions/article/{queued.article_id}")).json()
    assert (detail["status"], detail["declined"]) == ("failed", True)
    assert detail["prediction_summary"] is None
    assert await _entries(db_session) == []  # nothing was published, so nothing is logged
    # The screen saw who the story names without a public profile.
    screen = next(c for c in container.llm.calls if "PRIVATE-INDIVIDUAL CHECK" in c["prompt"])
    assert "Dana Roe" in screen["prompt"]
    assert len(container.llm.calls) == 1  # the outlook itself was never written
    status = (await client.get(f"/api/v1/predictions/{queued.id}/status")).json()
    assert status["progress_message"].startswith("Samā4 doesn't write outlooks about private")


async def test_a_public_figure_story_still_gets_an_outlook(client, container, db_session):
    queued = await _queued_for(
        db_session,
        "Senator proposes bill",
        people=[("Jane Senator", "https://en.wikipedia.org/wiki/Jane_Senator")],
    )
    container.llm.default = REPLY
    container.llm.replies = {"PRIVATE-INDIVIDUAL CHECK": '{"private_subject": false}'}

    await run_simulation(container, str(queued.id))

    detail = (await client.get(f"/api/v1/predictions/article/{queued.article_id}")).json()
    assert (detail["status"], detail["declined"]) == ("completed", False)
    outlook = container.llm.calls[-1]["prompt"]
    assert "named private individual" in outlook  # the outlook prompt carries the rule too


async def test_the_screen_fails_closed_when_its_answer_is_unreadable(client, container, db_session):
    queued = await _queued_for(db_session, "Anything", people=[])
    container.llm.default = REPLY
    container.llm.replies = {"PRIVATE-INDIVIDUAL CHECK": "I think it is fine!"}

    await run_simulation(container, str(queued.id))

    detail = (await client.get(f"/api/v1/predictions/article/{queued.article_id}")).json()
    assert (detail["status"], detail["declined"]) == ("failed", False)  # retryable
    assert detail["prediction_summary"] is None
