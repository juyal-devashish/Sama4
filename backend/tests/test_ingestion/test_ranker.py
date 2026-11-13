"""StoryRanker: parsing Claude's picks, guarding against invented ids, and the fallback."""

from datetime import UTC, datetime, timedelta

from app.ingestion.fetcher import FetchedArticle
from app.ingestion.ranker import Candidate, StoryRanker, fallback_selection, parse_selection
from tests.fakes import FakeLLM

NOW = datetime(2026, 11, 13, 12, tzinfo=UTC)


def _cand(i: int, feed: str = "a", hours: int = 1, offbeat: bool = False) -> Candidate:
    src = {"name": f"Src {feed}", "url": f"https://f.test/{feed}", "category": "world"}
    src["region"] = "india" if feed == "in" else "us"
    if offbeat:
        src["offbeat"] = True
    return Candidate(
        fetched=FetchedArticle(
            url=f"https://n.test/{feed}/{i}",
            title=f"Headline {i}",
            raw_content="<p>Teaser <b>text</b></p>",
            image_url=None,
            author=None,
            published_at=NOW - timedelta(hours=hours),
            source_name=src["name"],
            category="world",
        ),
        source=src,
    )


def test_parse_keeps_order_drops_invented_and_duplicate_coverage():
    cands = [_cand(i) for i in range(5)]
    text = (
        'Here you go: {"stories": ['
        '{"id": 3, "also": [0], "offbeat": false, "why": "big"},'
        '{"id": 0, "why": "same as 3"},'
        '{"id": "2"}, {"id": 42}, {"id": 2, "offbeat": true}], "note": "only two"}'
    )
    sel = parse_selection(text, cands, maximum=15)
    assert sel is not None
    assert [p.candidate.fetched.title for p in sel.picks] == ["Headline 3", "Headline 2"]
    assert [p.offbeat for p in sel.picks] == [False, True]
    assert sel.note == "only two"


def test_parse_caps_at_maximum_and_rejects_non_json():
    cands = [_cand(i) for i in range(20)]
    stories = ",".join(f'{{"id": {i}}}' for i in range(20))
    sel = parse_selection(f'{{"stories": [{stories}]}}', cands, maximum=15)
    assert sel is not None and len(sel.picks) == 15
    assert parse_selection("I can't help with that.", cands, maximum=15) is None
    assert parse_selection('{"stories": "nope"}', cands, maximum=15) is None


def test_fallback_takes_newest_round_robin_over_feeds():
    cands = [_cand(0, "a", hours=5), _cand(1, "a", hours=1), _cand(2, "b", hours=3)]
    sel = fallback_selection(cands, target=2)
    assert not sel.ranked
    assert [p.candidate.fetched.url for p in sel.picks] == [
        "https://n.test/a/1",
        "https://n.test/b/2",
    ]


async def test_prompt_lists_candidates_with_source_region_age_and_clean_teaser():
    llm = FakeLLM(default='{"stories": [{"id": 1}], "note": ""}')
    ranker = StoryRanker(llm, target=12, maximum=15)
    sel = await ranker.select([_cand(0), _cand(1, "in", hours=3, offbeat=True)], now=NOW)

    assert [p.candidate.fetched.title for p in sel.picks] == ["Headline 1"]
    call = llm.calls[0]
    assert "[1] Src in (india, offbeat desk) · 3h ago · Headline 1 — Teaser text" in call["prompt"]
    assert "top 12" in call["system"] and "up to 15" in call["system"]
    assert "USA, then India" in call["system"]


async def test_an_explicit_empty_edition_is_respected():
    llm = FakeLLM(default='{"stories": [], "note": "nothing cleared the bar"}')
    sel = await StoryRanker(llm).select([_cand(0)], now=NOW)
    assert sel.picks == [] and sel.note == "nothing cleared the bar"


async def test_no_candidates_means_no_call():
    llm = FakeLLM()
    assert (await StoryRanker(llm).select([])).picks == []
    assert llm.calls == []
