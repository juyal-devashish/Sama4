"""Which Wikipedia page a term links to, and same-name terms across stories.

The linker asks Wikidata for several candidates and Claude picks the one the term's
passage means, or none ("ICE" in an immigration story is the agency, not the German
train Wikidata ranks first). Entities are still shared by (name, type) across every
story, so "Paris" keeps the page chosen for the first story that mentioned it; the
`known_limit` test pins that so a change to it is a deliberate one.
"""

import json

from app.clients.wikimedia import (
    WikidataCandidate,
    WikimediaUnavailableError,
    parse_search_response,
)
from app.ingestion.linker import EntityLinker
from app.ingestion.ner import ExtractedEntity
from app.repositories import entities as entity_repo
from tests.fakes import FakeLLM

PARIS_FR = "https://en.wikipedia.org/wiki/Paris"
PARIS_TX = "https://en.wikipedia.org/wiki/Paris,_Texas"
TRAIN = "https://en.wikipedia.org/wiki/Intercity_Express"
AGENCY = "https://en.wikipedia.org/wiki/U.S._Immigration_and_Customs_Enforcement"


class Wikidata:
    """A fake Wikidata/Wikipedia: for each search text, hits in the order Wikidata ranks them."""

    def __init__(self, hits: dict[str, list[tuple[str, str, str | None]]]) -> None:
        # text -> [(wikidata id, wikipedia url, description)]
        self.hits = hits
        self.searches: list[str] = []
        self.refuse: set[str] = set()  # search texts or ids Wikimedia keeps refusing (429)

    async def search_candidates(self, text: str, limit: int = 7) -> list[WikidataCandidate]:
        self.searches.append(text)
        if text in self.refuse:
            raise WikimediaUnavailableError("429")
        return [
            WikidataCandidate(id=i, label=u.rsplit("/", 1)[-1], description=d or "")
            for i, u, d in self.hits.get(text, [])
        ][:limit]

    async def get_wikipedia_url(self, wikidata_id: str) -> str | None:
        if wikidata_id in self.refuse:
            raise WikimediaUnavailableError("429")
        return next((u for hs in self.hits.values() for i, u, _d in hs if i == wikidata_id), None)

    async def get_wikipedia_extract(self, url: str) -> str | None:
        return next((d for hs in self.hits.values() for _i, u, d in hs if u == url), None)


def entity(text: str, type_: str = "LOCATION") -> ExtractedEntity:
    return ExtractedEntity(
        text=text, type=type_, start=0, end=len(text), in_title=False, mention_count=1,
        priority="high",
    )  # fmt: skip


PARIS_HITS = {
    "Paris": [
        ("Q90", PARIS_FR, "Paris is the capital of France."),
        ("Q830149", PARIS_TX, "Paris is a city in Texas."),
    ]
}
ICE_HITS = {
    "ICE": [
        ("Q129172", TRAIN, "Intercity Express is a German high-speed train."),
        ("Q943091", AGENCY, "ICE is a US federal law enforcement agency."),
    ]
}


def claude_answering(answer: object) -> FakeLLM:
    return FakeLLM(default=answer if isinstance(answer, str) else json.dumps(answer))


async def test_a_name_with_one_obvious_page_links_to_it():
    ada = {"Ada Lovelace": [("Q7259", "https://w/Ada", "Mathematician.")]}
    linker = EntityLinker(Wikidata(ada), claude_answering({"t0": "Q7259"}))  # type: ignore[arg-type]

    linked = await linker.link_entity(entity("Ada Lovelace", "PERSON"))

    assert (linked.wikidata_id, linked.wikipedia_url) == ("Q7259", "https://w/Ada")
    assert linked.description == "Mathematician."


async def test_a_name_wikidata_does_not_know_stays_unlinked_but_is_kept():
    llm = FakeLLM()
    linker = EntityLinker(Wikidata({}), llm)  # type: ignore[arg-type]

    linked = await linker.link_entity(entity("Zxqv Plorb", "PERSON"))

    assert (linked.wikidata_id, linked.wikipedia_url, linked.description) == (None, None, None)
    assert linked.text == "Zxqv Plorb"  # still highlighted; just no sourced page
    assert llm.calls == []  # nothing to choose from, so Claude isn't asked


async def test_the_page_the_story_means_wins_over_the_most_popular_one():
    llm = claude_answering({"t0": "Q943091"})
    linker = EntityLinker(Wikidata(ICE_HITS), llm)  # type: ignore[arg-type]
    content = "Passengers filmed ICE officers detaining a father at the airport."

    [linked] = await linker.link_entities(
        [ExtractedEntity("ICE", "ORG", 17, 20, False, 1, "high")],
        content=content,
        title="Father detained by ICE at Seattle airport",
    )

    assert linked.wikipedia_url == AGENCY
    prompt = llm.calls[0]["prompt"]
    assert "detaining a father" in prompt and "Q129172" in prompt and "Q943091" in prompt


async def test_claude_choosing_none_leaves_the_term_unlinked():
    linker = EntityLinker(Wikidata(ICE_HITS), claude_answering({"t0": None}))  # type: ignore[arg-type]

    linked = await linker.link_entity(entity("ICE", "ORG"))

    assert (linked.wikidata_id, linked.wikipedia_url) == (None, None)


async def test_an_unreadable_answer_or_an_id_not_offered_never_falls_back_to_the_top_hit():
    for llm in (claude_answering("I think it's the agency."), claude_answering({"t0": "Q1"})):
        linker = EntityLinker(Wikidata(ICE_HITS), llm)  # type: ignore[arg-type]

        linked = await linker.link_entity(entity("ICE", "ORG"))

        assert linked.wikipedia_url is None


async def test_over_todays_budget_the_term_is_left_unlinked():
    llm = FakeLLM(exhausted=True)
    linker = EntityLinker(Wikidata(ICE_HITS), llm)  # type: ignore[arg-type]

    linked = await linker.link_entity(entity("ICE", "ORG"))

    assert linked.wikipedia_url is None


async def test_without_claude_every_story_gets_the_top_hit():
    linker = EntityLinker(Wikidata(PARIS_HITS))  # type: ignore[arg-type]

    linked = await linker.link_entity(entity("Paris"))

    assert linked.wikipedia_url == PARIS_FR


def test_a_disambiguation_page_is_never_a_candidate():
    data = {
        "search": [
            {"id": "Q1", "label": "Paris", "description": "Wikimedia disambiguation page"},
            {"id": "Q90", "label": "Paris", "description": "capital of France"},
        ]
    }

    assert [c.id for c in parse_search_response(data)] == ["Q90"]


async def test_known_limit_same_name_people_share_one_entity_and_one_explanation(db_session):
    async with db_session() as db:
        footballer = await entity_repo.get_or_create(db, name="John Smith", entity_type="PERSON")
        # ...a different John Smith, in another story, resolves to the very same row.
        poet = await entity_repo.get_or_create(db, name="John Smith", entity_type="PERSON")

    assert footballer.id == poet.id


async def test_the_same_name_with_a_different_type_stays_separate(db_session):
    async with db_session() as db:
        person = await entity_repo.get_or_create(db, name="Jordan", entity_type="PERSON")
        country = await entity_repo.get_or_create(db, name="Jordan", entity_type="LOCATION")

    assert person.id != country.id  # type is the only thing that tells same names apart today


async def test_a_refused_lookup_keeps_the_term_highlighted_with_no_page():
    wikidata = Wikidata(ICE_HITS)
    wikidata.refuse = {"ICE"}
    linker = EntityLinker(wikidata, claude_answering({"t0": "Q943091"}))  # type: ignore[arg-type]

    linked = await linker.link_entity(entity("ICE", "ORG"))

    assert linked.text == "ICE" and linked.wikipedia_url is None


async def test_a_refused_page_fetch_leaves_the_term_with_no_page():
    wikidata = Wikidata(ICE_HITS)
    wikidata.refuse = {"Q943091"}
    linker = EntityLinker(wikidata, claude_answering({"t0": "Q943091"}))  # type: ignore[arg-type]

    linked = await linker.link_entity(entity("ICE", "ORG"))

    assert (linked.wikidata_id, linked.wikipedia_url) == (None, None)
