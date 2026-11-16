from app.text import cap_words, sentence_ends


def test_abbreviations_and_initialisms_are_not_sentence_ends():
    text = "Louisiana Gov. Jeff Landry met U.S. officials. Then he left."
    ends = sentence_ends(text)
    assert [text[:e] for e in ends] == [
        "Louisiana Gov. Jeff Landry met U.S. officials.",
        text,
    ]


def test_a_quote_or_bracket_after_the_stop_stays_with_the_sentence():
    assert sentence_ends('He said "no." Then') == [len('He said "no."')]


def test_cap_words_never_stops_at_an_abbreviation():
    # The two cut-off summaries from the Nov 14 audit, rebuilt: the first real sentence
    # end falls past the limit, so the cut must end with an ellipsis, not at "U.S."
    housing = "Existing U.S. home sales rose for a third month in October as mortgage rates eased."
    assert cap_words(housing, 8) == "Existing U.S. home sales rose for a third…"

    tanker = (
        "A tanker spilled oil off the coast. Officials including Louisiana Gov. "
        "Jeff Landry said cleanup would take weeks."
    )
    assert cap_words(tanker, 11) == "A tanker spilled oil off the coast."


def test_cap_words_min_ratio_prefers_an_ellipsis_over_a_tiny_sentence():
    text = "Short. " + " ".join(["word"] * 20)
    assert cap_words(text, 10) == "Short."
    assert cap_words(text, 10, min_ratio=0.5).endswith("word…")


def test_cap_words_keeps_text_within_the_limit():
    assert cap_words("  One two three.  ", 5) == "One two three."
