"""Explanations have a hard length cap, and "More detail" gives a longer one on request."""

from app.services.context import BRIEF_MAX_WORDS, MORE_MAX_WORDS, cap_words
from tests.factories import make_article, make_entity


def test_short_text_is_left_alone():
    assert cap_words("One two three.", 10) == "One two three."


def test_long_text_is_cut_at_a_sentence_when_one_fits():
    text = "First sentence is here now. " + "word " * 40
    out = cap_words(text, 8)
    assert out == "First sentence is here now."
    assert len(out.split()) <= 8


def test_long_text_without_a_sentence_end_gets_an_ellipsis():
    out = cap_words("alpha " * 50, 10)
    assert out.endswith("…") and len(out.rstrip("…").split()) == 10


async def test_the_explanation_shown_beside_the_story_is_capped(client, container, db_session):
    async with db_session() as db:
        entity = await make_entity(db, name="Ada")
        await db.commit()
    container.llm.default = " ".join(f"Sentence number {i} says things." for i in range(40))

    text = (await client.get(f"/api/v1/context/{entity.id}")).json()["context"]["text"]

    assert len(text.split()) <= BRIEF_MAX_WORDS


async def test_more_detail_is_longer_capped_and_cached(client, container, db_session):
    async with db_session() as db:
        article = await make_article(db, title="Engines", content="Ada wrote the first program.")
        entity = await make_entity(db, name="Ada", article=article)
        await db.commit()
    container.llm.default = " ".join(f"Detail sentence {i} adds context." for i in range(80))

    first = (await client.get(f"/api/v1/context/{entity.id}/more")).json()
    second = (await client.get(f"/api/v1/context/{entity.id}/more")).json()

    assert 60 < len(first["text"].split()) <= MORE_MAX_WORDS
    assert (first["cached"], second["cached"]) == (False, True)
    assert len(container.llm.calls) == 1
    call = container.llm.calls[0]
    assert "two short paragraphs" in call["system"]  # the longer prompt, not the brief one
    assert "Ada wrote the first program." in call["prompt"]


async def test_more_detail_is_empty_not_an_error_when_claude_is_unavailable(
    client, container, db_session
):
    async with db_session() as db:
        entity = await make_entity(db, name="Ada")
        await db.commit()
    container.llm.available = False

    body = (await client.get(f"/api/v1/context/{entity.id}/more")).json()

    assert body["text"] == ""  # not cached, so a retry can succeed later


async def test_more_detail_for_an_unknown_entity_is_404(client):
    import uuid

    assert (await client.get(f"/api/v1/context/{uuid.uuid4()}/more")).status_code == 404
