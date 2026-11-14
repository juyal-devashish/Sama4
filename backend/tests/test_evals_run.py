"""The eval runner's scoring (no network)."""


def _item(linked, gold_url, labelled=True, tags=()):
    return {
        "linked_wikipedia_url": linked,
        "tags": list(tags),
        "gold": {"wikipedia_url": gold_url, "labelled_by": "x" if labelled else None},
    }


def test_same_page_normalizes_titles():
    from evals.run_context_eval import same_page

    assert same_page(
        "https://en.wikipedia.org/wiki/Caf%C3%A9", "https://en.wikipedia.org/wiki/café"
    )
    assert same_page(
        "https://en.wikipedia.org/wiki/Ada_Lovelace#Life", "https://x/wiki/Ada Lovelace"
    )
    assert not same_page("https://w/wiki/Cunningham", "https://w/wiki/Cade_Cunningham")
    assert not same_page(None, None)


def test_linker_score_counts_only_labelled_items():
    from evals.run_context_eval import linker_score

    items = [
        _item("https://w/wiki/A", "https://w/wiki/A"),  # right
        _item("https://w/wiki/Surname", "https://w/wiki/Person"),  # wrong page
        _item(None, None),  # no page, none linked: right
        _item("https://w/wiki/X", None),  # linked something with no gold page: wrong
        _item("https://w/wiki/A", "https://w/wiki/B", labelled=False),  # ignored
    ]
    assert linker_score(items) == {"n": 4, "correct": 2, "accuracy": 0.5}


def test_parse_verdict_and_explanation_score():
    from evals.run_context_eval import explanation_score, parse_verdict

    good = parse_verdict(
        '```json\n{"right_referent": true, "consistent": true, "reason": "ok"}\n```'
    )
    bad = parse_verdict('Here: {"right_referent": false, "consistent": true}')
    assert good and good["right_referent"] is True
    assert parse_verdict("no json") is None
    assert parse_verdict('{"right_referent": "yes"}') is None
    assert explanation_score([good, bad, None]) == {
        "n": 2,
        "unjudged": 1,
        "correct": 1,
        "accuracy": 0.5,
    }


def test_linker_score_uses_current_links_and_redirects():
    from evals.run_context_eval import linker_score

    item = {**_item("https://w/wiki/Old", "https://w/wiki/Palestine"), "id": "x"}
    redirects = {"Palestinian territories": "Palestine"}

    assert linker_score([item])["correct"] == 0  # the link recorded at build time
    now = {"x": "https://w/wiki/Palestinian_territories"}
    assert linker_score([item], now, redirects)["correct"] == 1


def test_excluded_items_are_not_scored():
    from evals.run_context_eval import linker_score

    item = _item("https://w/wiki/A", "https://w/wiki/B")
    item["gold"]["exclude"] = True
    assert linker_score([item]) == {"n": 0, "correct": 0, "accuracy": None}
