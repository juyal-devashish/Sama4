def test_cap_words_trims_long_summaries_to_a_whole_sentence():
    from app.ingestion.summarizer import cap_words

    long = "First sentence has five words. " + " ".join(["more"] * 70) + "."
    assert cap_words(long) == "First sentence has five words."
    assert cap_words("Short one.") == "Short one."
    assert cap_words(" ".join(["w"] * 80)).endswith("…")
