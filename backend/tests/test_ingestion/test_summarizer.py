def test_cap_words_trims_long_summaries_to_a_whole_sentence():
    from app.ingestion.summarizer import cap_words

    long = "First sentence has five words. " + " ".join(["more"] * 70) + "."
    assert cap_words(long) == "First sentence has five words."
    assert cap_words("Short one.") == "Short one."
    assert cap_words(" ".join(["w"] * 80)).endswith("…")


def test_summary_limit_scales_with_the_source():
    from app.ingestion.summarizer import summary_word_limit

    assert summary_word_limit(300) == 60  # a full opening: the usual cap
    assert summary_word_limit(3000) == 60
    assert summary_word_limit(80) == 40  # half a teaser
    assert summary_word_limit(20) == 15  # the floor
    assert summary_word_limit(12) == 12  # never longer than the source
    assert summary_word_limit(0) == 15


async def test_short_teaser_gets_a_short_summary():
    from app.ingestion.summarizer import SummarizerService
    from tests.fakes import FakeLLM

    llm = FakeLLM(default=" ".join(f"word{i}" for i in range(60)))
    teaser = " ".join(["teaser"] * 40)

    summary = await SummarizerService(llm).summarize(teaser, title="Headline")  # type: ignore[arg-type]

    assert len(summary.rstrip("…").split()) == 20
    assert "<word_limit>20</word_limit>" in llm.calls[0]["prompt"]
