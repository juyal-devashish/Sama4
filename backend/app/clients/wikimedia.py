"""Wikidata + Wikipedia lookups used to link and explain entities."""

import logging

import httpx

logger = logging.getLogger(__name__)

# Wikimedia APIs require a descriptive User-Agent.
_HEADERS = {"User-Agent": "sama4/0.1 (https://github.com/juyal-devashish/Sama4)"}

WIKIDATA_API = "https://www.wikidata.org/w/api.php"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"


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

    async def get_wikipedia_extract(self, url: str) -> str | None:
        """Return the first two sentences of a Wikipedia article, or None."""
        if not url:
            return None
        title = url.split("/wiki/")[-1]
        response = await self._http.get(
            WIKIPEDIA_API,
            params={
                "action": "query",
                "titles": title,
                "prop": "extracts",
                "exintro": True,
                "explaintext": True,
                "format": "json",
            },
        )
        if response.status_code != 200:
            logger.warning("Wikipedia extract returned %s", response.status_code)
            return None
        pages = response.json().get("query", {}).get("pages", {})
        for page in pages.values():
            sentences = page.get("extract", "").split(". ")[:2]
            return ". ".join(sentences) + "." if sentences else None
        return None
