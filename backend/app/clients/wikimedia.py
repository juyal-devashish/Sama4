"""Wikidata + Wikipedia lookups used to link and explain entities."""

import logging
from dataclasses import dataclass
from urllib.parse import unquote

import httpx

logger = logging.getLogger(__name__)

# Wikimedia APIs require a descriptive User-Agent.
_HEADERS = {"User-Agent": "sama4/0.1 (https://github.com/juyal-devashish/Sama4)"}

WIKIDATA_API = "https://www.wikidata.org/w/api.php"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"


@dataclass(frozen=True)
class WikipediaPage:
    """The opening of a Wikipedia article, and exactly which revision it came from."""

    extract: str
    title: str
    page_id: int | None
    revision_id: int | None

    @property
    def revision_url(self) -> str | None:
        if self.revision_id is None:
            return None
        return f"https://en.wikipedia.org/w/index.php?oldid={self.revision_id}"


def title_from_url(url: str) -> str:
    """ "https://en.wikipedia.org/wiki/Caf%C3%A9" -> "Café" (the API wants it decoded)."""
    return unquote(url.split("/wiki/")[-1].split("#")[0])


def parse_extract_response(data: dict) -> WikipediaPage | None:
    """First two sentences of the intro plus revision ids, from an extracts|revisions query."""
    pages = (data.get("query") or {}).get("pages") or {}
    for page in pages.values():
        text = (page.get("extract") or "").strip()
        if not text:
            return None
        sentences = text.split(". ")[:2]
        extract = ". ".join(sentences)
        if not extract.endswith("."):
            extract += "."
        revisions = page.get("revisions") or [{}]
        return WikipediaPage(
            extract=extract,
            title=page.get("title", ""),
            page_id=page.get("pageid"),
            revision_id=revisions[0].get("revid"),
        )
    return None


class WikimediaClient:
    """Wikidata and Wikipedia API lookups for entity enrichment.

    Holds one pooled httpx client for the process; call aclose() on shutdown.
    """

    def __init__(self, timeout: float = 15.0) -> None:
        self._http = httpx.AsyncClient(headers=_HEADERS, timeout=timeout)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def search_wikidata(self, text: str) -> str | None:
        """Return the best-matching Wikidata id (e.g. "Q189729") for text, or None."""
        response = await self._http.get(
            WIKIDATA_API,
            params={
                "action": "wbsearchentities",
                "search": text,
                "language": "en",
                "format": "json",
                "limit": 1,
            },
        )
        if response.status_code != 200:
            logger.warning("Wikidata search returned %s for %r", response.status_code, text)
            return None
        results = response.json().get("search")
        return results[0]["id"] if results else None

    async def get_wikipedia_url(self, wikidata_id: str) -> str | None:
        """Return the English Wikipedia URL for a Wikidata id, or None."""
        response = await self._http.get(
            WIKIDATA_API,
            params={
                "action": "wbgetentities",
                "ids": wikidata_id,
                "props": "sitelinks/urls",
                "sitefilter": "enwiki",
                "format": "json",
            },
        )
        if response.status_code != 200:
            logger.warning("Wikidata entity lookup returned %s", response.status_code)
            return None
        entity = response.json().get("entities", {}).get(wikidata_id, {})
        return entity.get("sitelinks", {}).get("enwiki", {}).get("url")

    async def get_wikipedia_page(self, url: str) -> WikipediaPage | None:
        """The first two sentences of a Wikipedia article and its current revision, or None."""
        if not url:
            return None
        response = await self._http.get(
            WIKIPEDIA_API,
            params={
                "action": "query",
                "titles": title_from_url(url),
                "prop": "extracts|revisions",
                "exintro": True,
                "explaintext": True,
                "rvprop": "ids",
                "redirects": True,
                "format": "json",
            },
        )
        if response.status_code != 200:
            logger.warning("Wikipedia extract returned %s", response.status_code)
            return None
        return parse_extract_response(response.json())

    async def get_wikipedia_extract(self, url: str) -> str | None:
        """Return the first two sentences of a Wikipedia article, or None."""
        page = await self.get_wikipedia_page(url)
        return page.extract if page else None
