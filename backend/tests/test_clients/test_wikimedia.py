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


async def _client(statuses: list[int]):
    """A WikimediaClient whose requests get `statuses` in turn (the last one repeats)."""
    import httpx

    from app.clients.wikimedia import WikimediaClient

    calls: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        status = statuses[min(len(calls), len(statuses) - 1)]
        calls.append(status)
        body = {"search": [{"id": "Q458", "label": "European Union", "description": "union"}]}
        return httpx.Response(status, json=body, headers={"Retry-After": "0"})

    client = WikimediaClient(retry_delay=0)
    client._http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return client, calls


async def test_a_429_is_retried_until_it_succeeds():
    client, calls = await _client([429, 503, 200])

    hits = await client.search_candidates("EU")

    assert [h.id for h in hits] == ["Q458"]
    assert calls == [429, 503, 200]


async def test_persistent_refusal_is_an_error_not_an_empty_result():
    import pytest

    from app.clients.wikimedia import MAX_TRIES, WikimediaUnavailableError

    client, calls = await _client([429])

    with pytest.raises(WikimediaUnavailableError):
        await client.search_candidates("EU")
    with pytest.raises(WikimediaUnavailableError):
        await client.get_wikipedia_url("Q458")
    assert len(calls) == 2 * MAX_TRIES
