import logging

import httpx

logger = logging.getLogger(__name__)

# Wikimedia APIs require a User-Agent header
_HEADERS = {"User-Agent": "sama4/0.1 (https://github.com/juyal-devashish/Minerva; sama4@example.com)"}


class EntityService:
    """Wikidata and Wikipedia API lookups for entity enrichment."""

    WIKIDATA_API = "https://www.wikidata.org/w/api.php"
    WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"

    async def search_wikidata(self, text: str) -> str | None:
        """Search Wikidata for an entity and return its ID.

        Args:
            text: Entity name to search.

        Returns:
            Wikidata ID (e.g., "Q189729") or None.
        """
        async with httpx.AsyncClient(headers=_HEADERS, timeout=15.0) as client:
            response = await client.get(
                self.WIKIDATA_API,
                params={
                    "action": "wbsearchentities",
                    "search": text,
                    "language": "en",
                    "format": "json",
                    "limit": 1,
                },
            )
            if response.status_code != 200:
                logger.warning(f"Wikidata search returned {response.status_code} for '{text}'")
                return None

            data = response.json()

            if data.get("search"):
                return data["search"][0]["id"]
            return None

    async def get_wikipedia_url(self, wikidata_id: str) -> str | None:
        """Get the Wikipedia URL for a Wikidata entity.

        Args:
            wikidata_id: Wikidata entity ID.

        Returns:
            English Wikipedia URL or None.
        """
        async with httpx.AsyncClient(headers=_HEADERS, timeout=15.0) as client:
            response = await client.get(
                self.WIKIDATA_API,
                params={
                    "action": "wbgetentities",
                    "ids": wikidata_id,
                    "props": "sitelinks/urls",
                    "sitefilter": "enwiki",
                    "format": "json",
                },
            )
            if response.status_code != 200:
                logger.warning(f"Wikidata entity lookup returned {response.status_code}")
                return None

            data = response.json()

            entity = data.get("entities", {}).get(wikidata_id, {})
            sitelinks = entity.get("sitelinks", {})
            enwiki = sitelinks.get("enwiki", {})
            return enwiki.get("url")

    async def get_wikipedia_extract(self, url: str) -> str | None:
        """Get a short extract from Wikipedia.

        Args:
            url: Wikipedia article URL.

        Returns:
            First 2 sentences of the article or None.
        """
        if not url:
            return None

        title = url.split("/wiki/")[-1]

        async with httpx.AsyncClient(headers=_HEADERS, timeout=15.0) as client:
            response = await client.get(
                self.WIKIPEDIA_API,
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
                logger.warning(f"Wikipedia extract returned {response.status_code}")
                return None

            data = response.json()

            pages = data.get("query", {}).get("pages", {})
            for page in pages.values():
                extract = page.get("extract", "")
                sentences = extract.split(". ")[:2]
                return ". ".join(sentences) + "." if sentences else None

            return None
