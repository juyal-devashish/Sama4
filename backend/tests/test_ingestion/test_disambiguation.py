"""Same-name people and places: what the app does today, and what it should do.

The linker looks a term up by its text alone and keeps the top Wikidata hit, and entities
are shared by (name, type) across every story. So "Paris" is the same entity in a story
about France and one about Texas. These tests pin that behaviour so a change to it is a
deliberate one: the `xfail(strict=True)` cases are the behaviour we want and don't have;
they start failing the build the day they begin to pass, so the markers get removed.
"""

import pytest

from app.ingestion.linker import EntityLinker
from app.ingestion.ner import ExtractedEntity
from app.repositories import entities as entity_repo

PARIS_FR = "https://en.wikipedia.org/wiki/Paris"
PARIS_TX = "https://en.wikipedia.org/wiki/Paris,_Texas"
DAB = "https://en.wikipedia.org/wiki/Paris_(disambiguation)"


class Wikidata:
    """A fake Wikidata/Wikipedia: for each search text, hits in the order Wikidata ranks them."""

    def __init__(self, hits: dict[str, list[tuple[str, str, str | None]]]) -> None:
        # text -> [(wikidata id, wikipedia url, description)]
        self.hits = hits
        self.searches: list[str] = []

    async def search_wikidata(self, text: str) -> str | None:
        self.searches.append(text)
        found = self.hits.get(text)
        return found[0][0] if found else None

    async def get_wikipedia_url(self, wikidata_id: str) -> str | None:
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


async def test_a_name_with_one_obvious_page_links_to_it():
    ada = {"Ada Lovelace": [("Q7259", "https://w/Ada", "Mathematician.")]}
    linker = EntityLinker(Wikidata(ada))  # type: ignore[arg-type]

    linked = await linker.link_entity(entity("Ada Lovelace", "PERSON"))

    assert (linked.wikidata_id, linked.wikipedia_url) == ("Q7259", "https://w/Ada")
    assert linked.description == "Mathematician."


async def test_a_name_wikidata_does_not_know_stays_unlinked_but_is_kept():
    linker = EntityLinker(Wikidata({}))  # type: ignore[arg-type]

    linked = await linker.link_entity(entity("Zxqv Plorb", "PERSON"))

    assert (linked.wikidata_id, linked.wikipedia_url, linked.description) == (None, None, None)
    assert linked.text == "Zxqv Plorb"  # still highlighted; just no sourced page


async def test_known_limit_every_story_gets_the_top_hit_for_a_same_name_term():
    # A story about Paris, Texas and one about Paris, France: today both link to the top hit.
    # Story context is not an input to linking at all (ExtractedEntity carries none).
    linker = EntityLinker(Wikidata(PARIS_HITS))  # type: ignore[arg-type]

    in_texas_story = await linker.link_entity(entity("Paris"))
    in_france_story = await linker.link_entity(entity("Paris"))

    assert in_texas_story.wikipedia_url == in_france_story.wikipedia_url == PARIS_FR


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


@pytest.mark.xfail(strict=True, reason="no story context reaches the linker yet")
async def test_wanted_the_page_the_story_means_wins_over_the_most_popular_one():
    linker = EntityLinker(Wikidata(PARIS_HITS))  # type: ignore[arg-type]
    texas = ExtractedEntity(
        text="Paris", type="LOCATION", start=0, end=5, in_title=False, mention_count=1,
        priority="high",
    )  # fmt: skip
    texas.context = "The Lamar County courthouse in Paris, Texas, was evacuated."  # type: ignore[attr-defined]

    linked = await linker.link_entity(texas)

    assert linked.wikipedia_url == PARIS_TX


@pytest.mark.xfail(strict=True, reason="disambiguation pages are not filtered out of the hits")
async def test_wanted_a_disambiguation_page_is_never_the_link():
    hits = {"Paris": [("Q1", DAB, "Wikimedia disambiguation page"), *PARIS_HITS["Paris"]]}
    linker = EntityLinker(Wikidata(hits))  # type: ignore[arg-type]

    linked = await linker.link_entity(entity("Paris"))

    assert linked.wikipedia_url != DAB
