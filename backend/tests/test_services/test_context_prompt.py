from app.models.entity import ArticleEntity
from app.prompts.templates import entity_context_prompt
from app.services.context import mention_excerpt


def _mention(start: int, end: int) -> ArticleEntity:
    return ArticleEntity(mention_text="x", start_position=start, end_position=end)


def test_prompt_omits_empty_sections():
    system, prompt = entity_context_prompt(name="Ada", entity_type="PERSON")
    assert prompt == '<term type="PERSON">Ada</term>'
    assert "never comment on what information" in system


def test_prompt_includes_story_and_background_when_present():
    _, prompt = entity_context_prompt(
        name="Ada",
        entity_type="PERSON",
        article_title="Engines return",
        article_excerpt="…Ada wrote notes…",
        background="Mathematician.",
    )
    assert "<headline>Engines return</headline>" in prompt
    assert "<excerpt>…Ada wrote notes…</excerpt>" in prompt
    assert "<background>\nMathematician.\n</background>" in prompt
    assert "related_news" not in prompt


def test_excerpt_keeps_short_text_whole():
    text = "Ada wrote the first program."
    assert mention_excerpt(text, _mention(0, 3)) == text


def test_excerpt_trims_to_words_around_the_mention():
    text = "alpha beta gamma Ada delta epsilon zeta"
    out = mention_excerpt(text, _mention(17, 20), radius=8)
    assert out == "…gamma Ada delta…"


def test_excerpt_empty_text():
    assert mention_excerpt("", _mention(0, 1)) is None
