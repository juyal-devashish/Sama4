import asyncio
import logging
from dataclasses import dataclass

from app.clients.llm import LLMClient
from app.clients.wikimedia import WikidataCandidate, WikimediaClient
from app.ingestion.ner import ExtractedEntity
from app.ingestion.page_choice import TermToLink, choose_pages, passage_around

logger = logging.getLogger(__name__)

LOOKUP_CONCURRENCY = 6  # parallel Wikidata/Wikipedia requests


@dataclass
class LinkedEntity:
    """An entity linked to Wikidata and Wikipedia."""

    text: str
    type: str
    start: int
    end: int
    in_title: bool
    priority: str
    wikidata_id: str | None
    wikipedia_url: str | None
    description: str | None


class EntityLinker:
    """Links extracted entities to the Wikidata item and Wikipedia page their story means.

    With Claude, each term's Wikidata candidates are shown to Claude with the passage the
    term is in, and Claude picks one or none. A term Claude doesn't answer gets no link:
    no page is better than the wrong one. Without Claude (tests, local dev with no key),
    the top Wikidata hit is used.
    """

    def __init__(self, wikimedia: WikimediaClient, llm: LLMClient | None = None) -> None:
        self.service = wikimedia
        self.llm = llm
        self._sem = asyncio.Semaphore(LOOKUP_CONCURRENCY)

    async def candidates(self, text: str) -> list[WikidataCandidate]:
        async with self._sem:
            return await self.service.search_candidates(text)

    async def page_for(self, wikidata_id: str | None) -> tuple[str | None, str | None]:
        """(Wikipedia URL, its opening sentences) for a Wikidata id, or (None, None)."""
        if not wikidata_id:
            return None, None
        async with self._sem:
            url = await self.service.get_wikipedia_url(wikidata_id)
            description = await self.service.get_wikipedia_extract(url) if url else None
        return url, description

    async def choose(self, terms: list[TermToLink]) -> dict[str, str | None]:
        """{key: Wikidata id or None}. Keys missing from the result have no answer."""
        if self.llm is not None and self.llm.available:
            return await choose_pages(self.llm, terms)
        return {t.key: (t.candidates[0].id if t.candidates else None) for t in terms}

    async def link_entity(
        self, entity: ExtractedEntity, *, context: str = "", headline: str = ""
    ) -> LinkedEntity:
        """Link one entity; `context` is the passage it appears in."""
        found = await self._link([(entity, context)], headline)
        if not found:
            raise RuntimeError(f"Could not look up {entity.text!r}")
        return found[0]

    async def link_entities(
        self, entities: list[ExtractedEntity], *, content: str = "", title: str = ""
    ) -> list[LinkedEntity]:
        """Link a story's entities. `content` is the text their offsets point into."""
        pairs = [(e, passage_around(content, e.start, e.end)) for e in entities]
        return await self._link(pairs, title)

    async def _link(
        self, pairs: list[tuple[ExtractedEntity, str]], headline: str
    ) -> list[LinkedEntity]:
        async def lookup(entity: ExtractedEntity) -> list[WikidataCandidate] | None:
            try:
                return await self.candidates(entity.text)
            except Exception:
                logger.error("Failed to look up entity: %s", entity.text, exc_info=True)
                return None

        found = await asyncio.gather(*(lookup(e) for e, _ in pairs))
        terms = [
            TermToLink(
                key=f"t{i}",
                text=e.text,
                type=e.type,
                headline=headline,
                context=ctx,
                candidates=cands,
            )  # fmt: skip
            for i, ((e, ctx), cands) in enumerate(zip(pairs, found, strict=True))
            if cands is not None
        ]
        chosen = await self.choose(terms)
        pages = await asyncio.gather(*(self.page_for(chosen.get(t.key)) for t in terms))
        by_key = dict(zip((t.key for t in terms), pages, strict=True))

        linked = []
        for i, (entity, _ctx) in enumerate(pairs):
            key = f"t{i}"
            if key not in by_key:
                continue  # the Wikidata lookup failed: skip the term, as before
            url, description = by_key[key]
            linked.append(
                LinkedEntity(
                    text=entity.text,
                    type=entity.type,
                    start=entity.start,
                    end=entity.end,
                    in_title=entity.in_title,
                    priority=entity.priority,
                    wikidata_id=chosen.get(key),
                    wikipedia_url=url,
                    description=description,
                )
            )
        return linked
