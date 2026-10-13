"""Hybrid NER: spaCy structural entities + LLM knowledge-gap detection.

The core insight: spaCy finds *what exists* (named entities), but samā4 needs
to find *what the reader doesn't know* (knowledge gaps). A Gen-Z reader doesn't
need "United States" explained — they need "quantitative tightening" or
"Article 50" or "Christine Lagarde" explained.

Pipeline:
  1. spaCy NER → structural named entities (filtered to remove obvious ones)
  2. LLM pass  → knowledge-gap terms (jargon, policies, acronyms, obscure people)
  3. Merge + deduplicate + priority-rank
"""

import json
import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

ENTITY_TYPE_MAP = {
    "PERSON": "PERSON",
    "ORG": "ORG",
    "NORP": "ORG",
    "GPE": "LOCATION",
    "LOC": "LOCATION",
    "FAC": "LOCATION",
    "EVENT": "EVENT",
    "WORK_OF_ART": "CONCEPT",
    "LAW": "CONCEPT",
    "PRODUCT": "CONCEPT",
}

ALLOWED_LABELS = set(ENTITY_TYPE_MAP.keys())

# Entities so widely known they add no explanatory value for any reader.
# Keep the list tight — when in doubt, leave it OUT (i.e. let the entity through).
COMMON_KNOWLEDGE: set[str] = {
    # Major countries & geopolitical blocs
    "united states", "us", "usa", "u.s.", "u.s.a.", "america",
    "china", "india", "russia", "uk", "united kingdom", "britain",
    "france", "germany", "japan", "canada", "australia",
    "european union", "eu", "nato",
    # Universally known orgs
    "google", "apple", "microsoft", "amazon", "meta", "facebook",
    "twitter", "x", "instagram", "youtube", "tiktok", "netflix",
    "tesla", "spacex",
    # Universally known people (sitting heads of major states)
    "donald trump", "trump", "joe biden", "biden",
    "xi jinping", "narendra modi", "modi",
    # Generic terms spaCy sometimes picks up
    "the government", "the white house", "congress",
    "the pentagon", "the fed", "wall street",
}


@dataclass
class ExtractedEntity:
    """An entity extracted from article text."""

    text: str
    type: str  # PERSON, ORG, LOCATION, EVENT, CONCEPT
    start: int
    end: int
    in_title: bool
    mention_count: int
    priority: str  # high, medium, low
    source: str = "spacy"  # "spacy" or "llm"


class NERService:
    """Hybrid NER: spaCy structural entities + LLM knowledge-gap detection."""

    def __init__(self) -> None:
        self._nlp = None
        self._llm = None

    @property
    def nlp(self):
        """Lazy-load spaCy model."""
        if self._nlp is None:
            import spacy
            try:
                self._nlp = spacy.load("en_core_web_trf")
            except OSError:
                logger.warning("en_core_web_trf not found, falling back to en_core_web_sm")
                self._nlp = spacy.load("en_core_web_sm")
        return self._nlp

    @property
    def llm(self):
        """Lazy-load LLM service."""
        if self._llm is None:
            from app.services.llm_service import LLMService
            self._llm = LLMService()
        return self._llm

    def extract_entities(self, content: str, title: str) -> list[ExtractedEntity]:
        """Extract entities using spaCy only (sync, for backward compat)."""
        return self._extract_spacy(content, title)

    async def extract_entities_hybrid(
        self, content: str, title: str, categories: list[str] | None = None
    ) -> list[ExtractedEntity]:
        """Extract entities using spaCy + LLM knowledge-gap detection.

        This is the preferred method — call this from the ingestion pipeline.
        Falls back to spaCy-only if LLM is unavailable.
        """
        spacy_entities = self._extract_spacy(content, title)

        llm_entities = await self._extract_llm_knowledge_gaps(content, title, categories)

        merged = self._merge_and_deduplicate(spacy_entities, llm_entities, content, title)

        return merged

    def _extract_spacy(self, content: str, title: str) -> list[ExtractedEntity]:
        """Stage 1: spaCy NER with common-knowledge filtering."""
        doc = self.nlp(content)

        entities = []
        seen: set[str] = set()

        for ent in doc.ents:
            if ent.label_ not in ALLOWED_LABELS:
                continue

            normalized = ent.text.strip()
            key = normalized.lower()

            if key in seen:
                continue

            # Filter out common-knowledge entities
            if key in COMMON_KNOWLEDGE:
                continue

            # Filter out very short entities (likely noise)
            if len(normalized) < 2:
                continue

            seen.add(key)

            in_title = key in title.lower()
            mention_count = content.lower().count(key)

            if in_title or mention_count >= 3:
                priority = "high"
            elif mention_count >= 2:
                priority = "medium"
            else:
                priority = "low"

            entities.append(
                ExtractedEntity(
                    text=normalized,
                    type=ENTITY_TYPE_MAP[ent.label_],
                    start=ent.start_char,
                    end=ent.end_char,
                    in_title=in_title,
                    mention_count=mention_count,
                    priority=priority,
                    source="spacy",
                )
            )

        return entities

    async def _extract_llm_knowledge_gaps(
        self,
        content: str,
        title: str,
        categories: list[str] | None = None,
    ) -> list[ExtractedEntity]:
        """Stage 2: LLM identifies terms a general reader wouldn't know.

        This catches: jargon, acronyms, policies, technical terms, lesser-known
        people, historical references, domain-specific concepts — everything
        spaCy misses because they aren't standard named entities.
        """
        if not self.llm.client:
            return []

        # Truncate content to fit token budget
        truncated = content[:3000]
        cat_hint = f"Article category: {', '.join(categories)}" if categories else ""

        prompt = f"""You are an expert at identifying terms in news articles that a typical 20-year-old reader would NOT immediately understand without additional context.

ARTICLE TITLE: {title}
{cat_hint}

ARTICLE TEXT:
{truncated}

---

Identify terms that need explanation. Focus on:
- Technical jargon (e.g. "quantitative easing", "yield curve inversion")
- Policy/legal names (e.g. "Article 50", "Section 230", "Dodd-Frank Act")
- Acronyms that aren't universally known (e.g. "FOMC", "IAEA", "ASEAN")
- Lesser-known people who matter to this story but aren't household names
- Domain-specific concepts (e.g. "repo rate", "herd immunity", "supply-side economics")
- Historical references the reader might not know (e.g. "Bretton Woods", "the Troubles")
- Organizations the reader might not know (e.g. "CERN", "Médecins Sans Frontières")

DO NOT include:
- Terms any adult would know (e.g. "president", "economy", "climate change")
- Major countries, big tech companies, or very famous people
- Generic words or phrases that don't carry specialized meaning

Return a JSON array of objects. Each object must have:
- "text": the exact term as it appears in the article (case-sensitive)
- "type": one of PERSON, ORG, LOCATION, EVENT, CONCEPT
- "reason": 5-10 word explanation of why this needs context

Return 5-15 terms, prioritizing the most important knowledge gaps.
Return ONLY the JSON array, no markdown."""

        try:
            raw = await self.llm.generate(
                prompt, model="gpt-4o-mini", max_tokens=800, temperature=0.2
            )

            # Parse response
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            cleaned = cleaned.strip()

            items = json.loads(cleaned)
            if not isinstance(items, list):
                return []

            entities = []
            for item in items:
                text = item.get("text", "").strip()
                entity_type = item.get("type", "CONCEPT").upper()
                if not text or entity_type not in {"PERSON", "ORG", "LOCATION", "EVENT", "CONCEPT"}:
                    continue

                # Find position in content
                match = re.search(re.escape(text), content)
                start = match.start() if match else 0
                end = match.end() if match else len(text)

                in_title = text.lower() in title.lower()
                mention_count = content.lower().count(text.lower())

                # LLM-identified terms get a priority boost since they represent
                # actual knowledge gaps
                if in_title or mention_count >= 3:
                    priority = "high"
                elif mention_count >= 1:
                    priority = "high"  # LLM said it's important → trust it
                else:
                    priority = "medium"

                entities.append(
                    ExtractedEntity(
                        text=text,
                        type=entity_type,
                        start=start,
                        end=end,
                        in_title=in_title,
                        mention_count=mention_count,
                        priority=priority,
                        source="llm",
                    )
                )

            return entities

        except Exception as e:
            logger.warning("LLM knowledge-gap extraction failed: %s", e)
            return []

    def _merge_and_deduplicate(
        self,
        spacy_entities: list[ExtractedEntity],
        llm_entities: list[ExtractedEntity],
        content: str,
        title: str,
    ) -> list[ExtractedEntity]:
        """Merge spaCy + LLM entities, deduplicate, and re-rank.

        LLM entities take precedence because they represent actual knowledge
        gaps, not just structural named entities.
        """
        merged: dict[str, ExtractedEntity] = {}

        # Add spaCy entities first
        for ent in spacy_entities:
            key = ent.text.lower()
            merged[key] = ent

        # LLM entities override spaCy (they represent reader knowledge gaps)
        for ent in llm_entities:
            key = ent.text.lower()
            if key in merged:
                # Keep the LLM source tag and boost priority
                existing = merged[key]
                existing.source = "both"
                existing.priority = "high"  # confirmed by both → definitely important
            else:
                merged[key] = ent

        entities = list(merged.values())

        # Sort: high > medium > low, then LLM-sourced first within same priority
        source_order = {"llm": 0, "both": 0, "spacy": 1}
        priority_order = {"high": 0, "medium": 1, "low": 2}
        entities.sort(
            key=lambda e: (priority_order.get(e.priority, 2), source_order.get(e.source, 1))
        )

        return entities
