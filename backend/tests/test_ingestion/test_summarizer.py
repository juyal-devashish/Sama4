from app.ingestion.summarizer import (
    MAX_SUMMARY_WORDS,
    SummarizerService,
    summary_word_limit,
    wants_brief,
    whole_sentences,
)
from tests.fakes import FakeLLM


def test_whole_sentences_keeps_the_sentences_that_fit():
    long = "First sentence has five words. " + " ".join(["more"] * 70) + "."
    assert whole_sentences(long) == "First sentence has five words."
    assert whole_sentences("  Short one.  ") == "Short one."
    assert whole_sentences("") is None


def test_whole_sentences_never_ends_mid_sentence():
    # The live bug: a 15-word limit cut "…agreed on Friday is a…"
    brief = (
        "Prime Minister Burnham will tell MPs that the EU deal agreed on Friday is a "
        "choice between a broken status quo or change. He faces a vote next week."
    )
    out = whole_sentences(brief, 15)
    assert out == (
        "Prime Minister Burnham will tell MPs that the EU deal agreed on Friday is a "
        "choice between a broken status quo or change."
    )
    assert not out.endswith("…")


def test_whole_sentences_drops_a_first_sentence_too_long_to_keep():
    assert whole_sentences(" ".join(["w"] * 80)) is None
    run_on = " ".join(["w"] * (MAX_SUMMARY_WORDS + 5)) + ". Then more."
    assert whole_sentences(run_on, 20) is None


def test_whole_sentences_does_not_stop_at_an_abbreviation():
    text = "Existing U.S. home sales rose for a third month in October. Prices also rose."
    assert whole_sentences(text, 12) == (
        "Existing U.S. home sales rose for a third month in October."
    )


def test_summary_limit_scales_with_the_source():
    assert summary_word_limit(300) == 60  # a full opening: the usual cap
    assert summary_word_limit(3000) == 60
    assert summary_word_limit(80) == 40  # half a teaser
    assert summary_word_limit(20) == 15  # the floor
    assert summary_word_limit(12) == 12  # never longer than the source
    assert summary_word_limit(0) == 15


def test_short_feed_text_gets_no_brief():
    assert not wants_brief(39)
    assert wants_brief(40)


async def test_short_feed_text_is_not_sent_to_claude():
    llm = FakeLLM(default="A brief.")
    teaser = "The prime minister will tell MPs the deal agreed on Friday is a choice."

    assert await SummarizerService(llm).summarize(teaser, title="Headline") is None  # type: ignore[arg-type]
    assert llm.calls == []


async def test_teaser_gets_a_brief_of_whole_sentences_within_its_limit():
    sentence = "One two three four five six seven eight nine ten."
    llm = FakeLLM(default=" ".join([sentence] * 6))
    teaser = " ".join(["teaser"] * 40)

    summary = await SummarizerService(llm).summarize(teaser, title="Headline")  # type: ignore[arg-type]

    assert summary == " ".join([sentence] * 2)  # 20 words: half the teaser
    assert "<word_limit>20</word_limit>" in llm.calls[0]["prompt"]
