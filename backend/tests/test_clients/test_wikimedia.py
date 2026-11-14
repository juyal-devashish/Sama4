from app.clients.wikimedia import parse_extract_response, title_from_url


def _response(page: dict) -> dict:
    return {"query": {"pages": {"1": page}}}


def test_extract_keeps_two_sentences_and_the_revision():
    page = parse_extract_response(
        _response(
            {
                "pageid": 1,
                "title": "Ada Lovelace",
                "extract": "Ada was a mathematician. She wrote notes. She died in 1852.",
                "revisions": [{"revid": 987, "parentid": 986}],
            }
        )
    )
    assert page is not None
    assert page.extract == "Ada was a mathematician. She wrote notes."
    assert (page.title, page.page_id, page.revision_id) == ("Ada Lovelace", 1, 987)
    assert page.revision_url == "https://en.wikipedia.org/w/index.php?oldid=987"


def test_missing_page_or_empty_extract_is_none():
    assert parse_extract_response({}) is None
    assert parse_extract_response(_response({"title": "Nope", "missing": ""})) is None


def test_single_sentence_gets_one_full_stop():
    page = parse_extract_response(_response({"title": "X", "extract": "X is a thing."}))
    assert page is not None and page.extract == "X is a thing."
    assert page.revision_id is None and page.revision_url is None


def test_title_from_url_decodes_and_drops_fragment():
    assert title_from_url("https://en.wikipedia.org/wiki/Caf%C3%A9#History") == "Café"
