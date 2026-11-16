"""GET /context/{id}/stream: the explanation as Server-Sent Events."""

import json
from datetime import UTC, datetime

from tests.factories import make_article, make_entity

TODAY = datetime.now(UTC).date().isoformat()


def events(body: str) -> list[tuple[str, dict]]:
    out = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        out.append((lines["event"], json.loads(lines["data"])))
    return out


async def _entity(db_session, name="Ada"):
    async with db_session() as db:
        article = await make_article(db, title="Engines", content="Ada wrote the first program.")
        entity = await make_entity(db, name=name, article=article)
        await db.commit()
        return entity, article


async def test_text_streams_in_pieces_then_one_done_with_the_full_response(
    client, container, db_session
):
    entity, article = await _entity(db_session)
    container.llm.default = "Ada wrote the first program for a machine."

    response = await client.get(f"/api/v1/context/{entity.id}/stream?article_id={article.id}")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["x-accel-buffering"] == "no"
    seen = events(response.text)
    kinds = [k for k, _ in seen]
    assert kinds[-1] == "done" and kinds.count("done") == 1 and kinds.count("delta") > 1
    streamed = "".join(d["text"] for k, d in seen if k == "delta").strip()
    done = seen[-1][1]
    assert streamed == "Ada wrote the first program for a machine."
    assert done["context"]["text"] == streamed  # (already within the length cap)
    assert done["entity"]["name"] == "Ada"
    assert done["context"]["cached"] is False
    assert container.llm.calls[-1]["streamed"] is True


async def test_the_done_event_is_what_the_plain_get_returns_afterwards(
    client, container, db_session
):
    entity, article = await _entity(db_session)
    container.llm.default = "A short explanation."
    url = f"/api/v1/context/{entity.id}"

    streamed = events((await client.get(f"{url}/stream?article_id={article.id}")).text)[-1][1]
    plain = (await client.get(f"{url}?article_id={article.id}")).json()

    assert plain["context"]["text"] == streamed["context"]["text"]
    assert plain["context"]["cached"] is True  # the stream cached it
    assert len(container.llm.calls) == 1


async def test_a_cached_explanation_sends_only_done(client, container, db_session):
    entity, article = await _entity(db_session)
    container.llm.default = "Cached text."
    await client.get(f"/api/v1/context/{entity.id}?article_id={article.id}")

    seen = events(
        (await client.get(f"/api/v1/context/{entity.id}/stream?article_id={article.id}")).text
    )

    assert [k for k, _ in seen] == ["done"]
    assert seen[0][1]["context"]["cached"] is True


async def test_unknown_entity_is_a_plain_404_not_a_stream(client):
    import uuid

    response = await client.get(f"/api/v1/context/{uuid.uuid4()}/stream")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


async def test_over_the_daily_budget_the_stream_falls_back_to_the_wikipedia_text(
    client, container, db_session
):
    entity, _ = await _entity(db_session)
    container.llm.exhausted = True

    seen = events((await client.get(f"/api/v1/context/{entity.id}/stream")).text)

    assert [k for k, _ in seen] == ["done"]
    assert seen[0][1]["context"]["source"] == "wikipedia_extract"


async def test_a_failure_while_writing_ends_with_an_error_event(client, container, db_session):
    entity, _ = await _entity(db_session)

    async def broken(prompt, **kwargs):
        raise RuntimeError("boom")
        yield  # pragma: no cover

    container.llm.stream = broken

    seen = events((await client.get(f"/api/v1/context/{entity.id}/stream")).text)

    assert [k for k, _ in seen] == ["error"]
    assert "could not be written" in seen[0][1]["detail"]


async def test_streaming_shares_the_rate_limit_and_the_usage_counter(client, container, db_session):
    entity, _ = await _entity(db_session)
    container.llm.default = "Text."

    await client.get(f"/api/v1/context/{entity.id}/stream", headers={"X-Forwarded-For": "1.2.3.4"})
    await client.get(f"/api/v1/context/{entity.id}", headers={"X-Forwarded-For": "1.2.3.4"})

    assert container.cache.store["ratelimit:context:1.2.3.4"] == 2  # one bucket for both
    assert container.cache.store[f"usage:{TODAY}:term_explained"] == 2
