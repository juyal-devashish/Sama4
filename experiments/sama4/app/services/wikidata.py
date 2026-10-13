"""Wikidata API client for entity search and structured fact retrieval."""

import logging
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": "sama4/0.1 (https://github.com/juyal-devashish/Minerva; sama4@example.com)"
}

WIKIDATA_API = "https://www.wikidata.org/w/api.php"

# -----------------------------------------------------------------------
# Wikidata property IDs we care about, grouped by entity type.
# -----------------------------------------------------------------------
PERSON_PROPS = {
    "P569": "date_of_birth",
    "P570": "date_of_death",
    "P27": "citizenship",
    "P106": "occupation",
    "P39": "position_held",
}

ORG_PROPS = {
    "P571": "founded",
    "P159": "headquarters",
    "P17": "country",
    "P452": "industry",
}

LOCATION_PROPS = {
    "P17": "country",
    "P1082": "population",
    "P36": "capital",
}

EVENT_PROPS = {
    "P585": "point_in_time",
    "P276": "location",
    "P17": "country",
}

# Fallback for CONCEPT or unknown types
DEFAULT_PROPS = {
    "P31": "instance_of",
}

PROPS_BY_TYPE: dict[str, dict[str, str]] = {
    "PERSON": PERSON_PROPS,
    "ORG": ORG_PROPS,
    "LOCATION": LOCATION_PROPS,
    "EVENT": EVENT_PROPS,
    "CONCEPT": DEFAULT_PROPS,
}


# -----------------------------------------------------------------------
# Data classes
# -----------------------------------------------------------------------
@dataclass
class WikidataSearchResult:
    """A single result from a Wikidata entity search."""

    qid: str  # e.g. "Q42"
    label: str
    description: str | None = None


@dataclass
class EntityFacts:
    """Structured facts retrieved from Wikidata for an entity."""

    qid: str
    label: str
    description: str | None = None
    wikipedia_url: str | None = None
    facts: dict[str, str] = field(default_factory=dict)


# -----------------------------------------------------------------------
# Service
# -----------------------------------------------------------------------
class WikidataService:
    """Search entities and retrieve structured facts from Wikidata."""

    def __init__(self, timeout: float = 15.0) -> None:
        self._timeout = timeout

    # ------------------------------------------------------------------
    # 1. Search entity by name
    # ------------------------------------------------------------------
    async def search(
        self, name: str, *, limit: int = 3
    ) -> list[WikidataSearchResult]:
        """Search Wikidata for entities matching *name*.

        Args:
            name: Entity name to search (e.g. "Narendra Modi").
            limit: Max results to return (1-5).

        Returns:
            List of search results with QID, label, description.
        """
        async with httpx.AsyncClient(headers=_HEADERS, timeout=self._timeout) as client:
            resp = await client.get(
                WIKIDATA_API,
                params={
                    "action": "wbsearchentities",
                    "search": name,
                    "language": "en",
                    "format": "json",
                    "limit": min(limit, 5),
                },
            )

        if resp.status_code != 200:
            logger.warning("Wikidata search returned %d for '%s'", resp.status_code, name)
            return []

        data = resp.json()
        results: list[WikidataSearchResult] = []

        for item in data.get("search", []):
            results.append(
                WikidataSearchResult(
                    qid=item["id"],
                    label=item.get("label", name),
                    description=item.get("description"),
                )
            )

        return results

    async def search_one(self, name: str) -> WikidataSearchResult | None:
        """Return the top search result for *name*, or None."""
        results = await self.search(name, limit=1)
        return results[0] if results else None

    # ------------------------------------------------------------------
    # 2. Get facts and dates for entity
    # ------------------------------------------------------------------
    async def get_facts(
        self, qid: str, entity_type: str = "CONCEPT"
    ) -> EntityFacts:
        """Fetch structured facts for a Wikidata entity.

        Uses the property set matching *entity_type* (PERSON, ORG, etc.)
        to extract only relevant claims.

        Args:
            qid: Wikidata entity ID (e.g. "Q42").
            entity_type: One of PERSON, ORG, LOCATION, EVENT, CONCEPT.

        Returns:
            EntityFacts with label, description, wikipedia URL, and facts dict.
        """
        async with httpx.AsyncClient(headers=_HEADERS, timeout=self._timeout) as client:
            resp = await client.get(
                WIKIDATA_API,
                params={
                    "action": "wbgetentities",
                    "ids": qid,
                    "props": "labels|descriptions|claims|sitelinks/urls",
                    "languages": "en",
                    "sitefilter": "enwiki",
                    "format": "json",
                },
            )

        if resp.status_code != 200:
            logger.warning("Wikidata entity fetch returned %d for %s", resp.status_code, qid)
            return EntityFacts(qid=qid, label=qid)

        entity_data = resp.json().get("entities", {}).get(qid, {})

        label = (
            entity_data.get("labels", {}).get("en", {}).get("value", qid)
        )
        description = (
            entity_data.get("descriptions", {}).get("en", {}).get("value")
        )
        wikipedia_url = (
            entity_data.get("sitelinks", {}).get("enwiki", {}).get("url")
        )

        # Extract claims matching our property set
        claims = entity_data.get("claims", {})
        prop_map = PROPS_BY_TYPE.get(entity_type, DEFAULT_PROPS)
        facts = self._extract_claims(claims, prop_map)

        # Resolve any QID values (e.g. "Q668" → "India") to human labels
        facts = await self._resolve_qid_labels(facts)

        return EntityFacts(
            qid=qid,
            label=label,
            description=description,
            wikipedia_url=wikipedia_url,
            facts=facts,
        )

    async def search_and_get_facts(
        self, name: str, entity_type: str = "CONCEPT"
    ) -> EntityFacts | None:
        """Search by name then fetch facts — convenience one-shot method."""
        result = await self.search_one(name)
        if result is None:
            return None
        return await self.get_facts(result.qid, entity_type)

    # ------------------------------------------------------------------
    # Claim parsing helpers
    # ------------------------------------------------------------------
    def _extract_claims(
        self, claims: dict, prop_map: dict[str, str]
    ) -> dict[str, str]:
        """Pull human-readable values from Wikidata claims.

        Handles three snak value types:
         - time  → formatted date string
         - wikibase-entityid → resolved later or returned as QID
         - string / quantity → raw value
        """
        facts: dict[str, str] = {}

        for prop_id, fact_name in prop_map.items():
            claim_list = claims.get(prop_id, [])
            if not claim_list:
                continue

            snak = claim_list[0].get("mainsnak", {})
            value = self._parse_snak_value(snak)
            if value:
                facts[fact_name] = value

        return facts

    async def _resolve_qid_labels(self, facts: dict[str, str]) -> dict[str, str]:
        """Replace QID values (e.g. "Q668") with human-readable labels.

        Makes a single batch API call for all QIDs found in fact values.
        """
        qids = [v for v in facts.values() if v.startswith("Q") and v[1:].isdigit()]
        if not qids:
            return facts

        async with httpx.AsyncClient(headers=_HEADERS, timeout=self._timeout) as client:
            resp = await client.get(
                WIKIDATA_API,
                params={
                    "action": "wbgetentities",
                    "ids": "|".join(qids),
                    "props": "labels",
                    "languages": "en",
                    "format": "json",
                },
            )

        if resp.status_code != 200:
            return facts

        entities = resp.json().get("entities", {})
        label_map = {}
        for qid_key, ent_data in entities.items():
            lbl = ent_data.get("labels", {}).get("en", {}).get("value")
            if lbl:
                label_map[qid_key] = lbl

        return {k: label_map.get(v, v) for k, v in facts.items()}

    @staticmethod
    def _parse_snak_value(snak: dict) -> str | None:
        """Parse a single Wikidata snak into a human-readable string."""
        datavalue = snak.get("datavalue")
        if datavalue is None:
            return None

        vtype = datavalue.get("type")
        val = datavalue.get("value")

        if vtype == "time":
            return _format_wikidata_time(val.get("time", ""))

        if vtype == "wikibase-entityid":
            # Return the QID; caller can resolve labels in bulk if needed
            return val.get("id", "")

        if vtype == "quantity":
            amount = val.get("amount", "")
            # Strip leading '+' from positive quantities
            return amount.lstrip("+")

        if vtype == "string":
            return val

        return None


# -----------------------------------------------------------------------
# Utilities
# -----------------------------------------------------------------------
def _format_wikidata_time(time_str: str) -> str:
    """Convert Wikidata time format to readable date.

    Wikidata times look like "+1952-03-11T00:00:00Z".
    Returns "11 March 1952".
    """
    if not time_str:
        return ""

    # Strip leading +/- and trailing time portion
    date_part = time_str.lstrip("+-").split("T")[0]

    try:
        parts = date_part.split("-")
        year = int(parts[0])
        month = int(parts[1]) if len(parts) > 1 else 0
        day = int(parts[2]) if len(parts) > 2 else 0
    except (ValueError, IndexError):
        return date_part

    months = [
        "", "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]

    if month == 0:
        return str(year)
    if day == 0:
        return f"{months[month]} {year}"
    return f"{day} {months[month]} {year}"
