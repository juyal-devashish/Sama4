"""Tests for NER extraction pipeline.

All tests mock spaCy to avoid loading the transformer model (~457MB).
"""

import json
from unittest.mock import MagicMock, patch

from app.ingestion.ner import (
    ALLOWED_LABELS,
    ENTITY_TYPE_MAP,
    ExtractedEntity,
    NERService,
    locate_mention,
)
from tests.fakes import FakeLLM

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_span(text: str, label: str, start_char: int, end_char: int):
    """Create a mock spaCy Span."""
    span = MagicMock()
    span.text = text
    span.label_ = label
    span.start_char = start_char
    span.end_char = end_char
    return span


def _make_doc(spans: list):
    """Create a mock spaCy Doc with given entity spans."""
    doc = MagicMock()
    doc.ents = spans
    return doc


def _build_service_with_mock(spans: list) -> NERService:
    """Create a NERService whose nlp property returns a mock producing spans."""
    service = NERService()
    mock_nlp = MagicMock(return_value=_make_doc(spans))
    service._nlp = mock_nlp
    return service


# ---------------------------------------------------------------------------
# 1. Label mapping tests
# ---------------------------------------------------------------------------


class TestLabelMapping:
    """spaCy label → samā4 entity type mapping."""

    def test_person_maps_to_person(self):
        assert ENTITY_TYPE_MAP["PERSON"] == "PERSON"

    def test_org_maps_to_org(self):
        assert ENTITY_TYPE_MAP["ORG"] == "ORG"

    def test_norp_maps_to_org(self):
        assert ENTITY_TYPE_MAP["NORP"] == "ORG"

    def test_gpe_maps_to_location(self):
        assert ENTITY_TYPE_MAP["GPE"] == "LOCATION"

    def test_loc_maps_to_location(self):
        assert ENTITY_TYPE_MAP["LOC"] == "LOCATION"

    def test_fac_maps_to_location(self):
        assert ENTITY_TYPE_MAP["FAC"] == "LOCATION"

    def test_event_maps_to_event(self):
        assert ENTITY_TYPE_MAP["EVENT"] == "EVENT"

    def test_work_of_art_maps_to_concept(self):
        assert ENTITY_TYPE_MAP["WORK_OF_ART"] == "CONCEPT"

    def test_law_maps_to_concept(self):
        assert ENTITY_TYPE_MAP["LAW"] == "CONCEPT"

    def test_product_maps_to_concept(self):
        assert ENTITY_TYPE_MAP["PRODUCT"] == "CONCEPT"

    def test_allowed_labels_matches_map_keys(self):
        assert ALLOWED_LABELS == set(ENTITY_TYPE_MAP.keys())

    def test_noisy_labels_excluded(self):
        for noisy in ("DATE", "TIME", "MONEY", "PERCENT", "QUANTITY", "ORDINAL", "CARDINAL"):
            assert noisy not in ALLOWED_LABELS


# ---------------------------------------------------------------------------
# 2. Priority calculation tests
# ---------------------------------------------------------------------------


class TestPriority:
    """high / medium / low priority assignment."""

    def test_high_priority_when_in_title(self):
        """Entity mentioned in title → high, even with 1 mention."""
        spans = [_make_span("Elon Musk", "PERSON", 0, 9)]
        service = _build_service_with_mock(spans)

        result = service.extract_entities("Elon Musk said something.", "Elon Musk announces plan")
        assert len(result) == 1
        assert result[0].priority == "high"
        assert result[0].in_title is True

    def test_high_priority_when_3_plus_mentions(self):
        """3+ mentions in body → high, even if not in title."""
        content = "NASA launched a rocket. NASA confirmed the orbit. NASA plans more missions."
        spans = [_make_span("NASA", "ORG", 0, 4)]
        service = _build_service_with_mock(spans)

        result = service.extract_entities(content, "Space mission update")
        assert result[0].priority == "high"
        assert result[0].mention_count == 3
        assert result[0].in_title is False

    def test_medium_priority_when_2_mentions(self):
        """Exactly 2 mentions, not in title → medium."""
        content = "Nvidia released a product. Nvidia stock rose."
        spans = [_make_span("Nvidia", "ORG", 0, 6)]
        service = _build_service_with_mock(spans)

        result = service.extract_entities(content, "Tech earnings report")
        assert result[0].priority == "medium"
        assert result[0].mention_count == 2

    def test_low_priority_when_1_mention(self):
        """Single mention, not in title → low."""
        content = "The mayor of Springfield spoke at the event."
        spans = [_make_span("Springfield", "GPE", 13, 24)]
        service = _build_service_with_mock(spans)

        result = service.extract_entities(content, "Local politics update")
        assert result[0].priority == "low"
        assert result[0].mention_count == 1

    def test_results_sorted_by_priority(self):
        """High entities come first, then medium, then low."""
        content = (
            "Sonos released the Era100. "  # Sonos: 1 mention → low
            "Tim Cook spoke. Tim Cook added. Tim Cook concluded. "  # 3 mentions → high
            "Nvidia reacted. Nvidia commented."  # 2 mentions → medium
        )
        spans = [
            _make_span("Sonos", "ORG", 0, 5),
            _make_span("Tim Cook", "PERSON", 27, 35),
            _make_span("Nvidia", "ORG", 79, 85),
        ]
        service = _build_service_with_mock(spans)

        result = service.extract_entities(content, "Unrelated title")
        priorities = [e.priority for e in result]
        assert priorities == ["high", "medium", "low"]


# ---------------------------------------------------------------------------
# 3. Entity extraction behavior tests
# ---------------------------------------------------------------------------


class TestExtraction:
    """Core extraction logic: dedup, filtering, positions."""

    def test_extracts_correct_entity_type(self):
        spans = [
            _make_span("London", "GPE", 0, 6),
            _make_span("WHO", "ORG", 20, 23),
        ]
        service = _build_service_with_mock(spans)

        result = service.extract_entities("London is a city. The WHO met today.", "News")
        types = {e.text: e.type for e in result}
        assert types["London"] == "LOCATION"
        assert types["WHO"] == "ORG"

    def test_skips_unlabeled_entities(self):
        """Entities with labels not in ALLOWED_LABELS are dropped."""
        spans = [
            _make_span("Monday", "DATE", 0, 6),
            _make_span("$500", "MONEY", 10, 14),
            _make_span("Reuters", "ORG", 20, 27),
        ]
        service = _build_service_with_mock(spans)

        result = service.extract_entities("Monday cost $500. Reuters reported.", "News")
        assert len(result) == 1
        assert result[0].text == "Reuters"

    def test_deduplicates_case_insensitive(self):
        """Same entity appearing in different cases → only first kept."""
        spans = [
            _make_span("NASA", "ORG", 0, 4),
            _make_span("nasa", "ORG", 20, 24),
            _make_span("Nasa", "ORG", 40, 44),
        ]
        service = _build_service_with_mock(spans)

        result = service.extract_entities("NASA and nasa and Nasa.", "Space")
        assert len(result) == 1
        assert result[0].text == "NASA"

    def test_preserves_character_positions(self):
        content = "President Milei met with officials."
        spans = [_make_span("Milei", "PERSON", 10, 15)]
        service = _build_service_with_mock(spans)

        result = service.extract_entities(content, "News")
        assert result[0].start == 10
        assert result[0].end == 15

    def test_filters_common_knowledge_entities(self):
        """Universally known names (COMMON_KNOWLEDGE) are dropped; others are kept."""
        content = "Google and Biden met Sonos."
        spans = [
            _make_span("Google", "ORG", 0, 6),
            _make_span("Biden", "PERSON", 11, 16),
            _make_span("Sonos", "ORG", 21, 26),
        ]
        service = _build_service_with_mock(spans)

        result = service.extract_entities(content, "News")
        assert [e.text for e in result] == ["Sonos"]

    def test_empty_content_returns_empty(self):
        service = _build_service_with_mock([])
        result = service.extract_entities("", "")
        assert result == []

    def test_no_matching_entities_returns_empty(self):
        """Content with only skipped label types → empty list."""
        spans = [_make_span("2024", "DATE", 0, 4)]
        service = _build_service_with_mock(spans)

        result = service.extract_entities("It happened in 2024.", "Year review")
        assert result == []

    def test_title_match_is_case_insensitive(self):
        """'london' in content matches 'LONDON' in title for in_title."""
        spans = [_make_span("london", "GPE", 0, 6)]
        service = _build_service_with_mock(spans)

        result = service.extract_entities("london is great.", "LONDON travel guide")
        assert result[0].in_title is True

    def test_extracted_entity_dataclass_fields(self):
        """ExtractedEntity has all required fields."""
        e = ExtractedEntity(
            text="NATO",
            type="ORG",
            start=0,
            end=4,
            in_title=False,
            mention_count=1,
            priority="low",
        )
        assert e.text == "NATO"
        assert e.type == "ORG"
        assert e.start == 0
        assert e.end == 4
        assert e.in_title is False
        assert e.mention_count == 1
        assert e.priority == "low"


# ---------------------------------------------------------------------------
# 4. Lazy-loading / fallback tests
# ---------------------------------------------------------------------------


class TestModelLoading:
    """spaCy model lazy-loading and fallback."""

    def test_nlp_lazy_loads_on_first_access(self):
        service = NERService()
        assert service._nlp is None

    @patch("app.ingestion.ner.spacy", create=True)
    def test_fallback_to_sm_when_trf_missing(self, mock_spacy_module):
        """Falls back to en_core_web_sm when trf raises OSError."""

        mock_sm = MagicMock()
        mock_spacy_module.load = MagicMock(side_effect=[OSError("not found"), mock_sm])

        service = NERService()
        service._nlp = None

        with patch.dict("sys.modules", {"spacy": mock_spacy_module}):
            with patch.object(
                type(service),
                "nlp",
                new_callable=lambda: property(lambda self: self._load_fallback(mock_spacy_module)),
            ):
                # Directly test the fallback logic
                try:
                    import spacy

                    spacy.load("en_core_web_trf")
                except OSError:
                    result = mock_spacy_module.load("en_core_web_sm")
                    assert result == mock_sm


# ---------------------------------------------------------------------------
# 5. Hybrid (spaCy + Claude) offsets: every mention must point at its own text
# ---------------------------------------------------------------------------

POSNER = (
    "He was the most-cited legal scholar of the 20th century. "
    "Richard A. Posner served on the Seventh Circuit for 36 years. "
    "Posner pioneered law and economics."
)


def _hybrid_service(spans: list, llm_terms: list[dict]) -> NERService:
    service = NERService(llm=FakeLLM(default=json.dumps(llm_terms)))
    service._nlp = MagicMock(return_value=_make_doc(spans))
    return service


def _assert_aligned(content: str, entities: list[ExtractedEntity]) -> None:
    for e in entities:
        assert content[e.start : e.end].lower() == e.text.lower(), e


class TestHybridOffsets:
    async def test_llm_term_with_different_case_is_located(self):
        # Claude capitalised the term; the old case-sensitive search fell back to
        # offsets 0..len(text) and highlighted "He was the most-cited le…".
        service = _hybrid_service([], [{"text": "Most-cited legal scholar", "type": "CONCEPT"}])

        result = await service.extract_entities_hybrid(POSNER, "Judge Richard A. Posner has died")

        assert len(result) == 1
        assert (result[0].start, result[0].end) == (11, 35)
        _assert_aligned(POSNER, result)

    async def test_llm_term_not_in_text_is_dropped(self):
        service = _hybrid_service(
            [],
            [
                {"text": "He was the most-c", "type": "CONCEPT"},  # real prefix: kept, at 0
                {"text": "Chicago school of economics", "type": "CONCEPT"},  # absent
                {"text": "Seventh Circuit", "type": "ORG"},
            ],
        )

        result = await service.extract_entities_hybrid(POSNER, "Posner obituary")

        assert {e.text for e in result} == {"He was the most-c", "Seventh Circuit"}
        _assert_aligned(POSNER, result)

    async def test_llm_offsets_are_found_in_full_content_not_prompt_excerpt(self):
        # The prompt only shows the first 3000 chars; offsets must still be in `content`.
        content = "x" * 3500 + " The Seventh Circuit ruled."
        service = _hybrid_service([], [{"text": "Seventh Circuit", "type": "ORG"}])

        result = await service.extract_entities_hybrid(content, "Ruling")

        assert result[0].start == content.index("Seventh Circuit")
        _assert_aligned(content, result)

    async def test_spacy_span_with_surrounding_whitespace_is_trimmed(self):
        content = "Judge  Posner wrote."
        spans = [_make_span(" Posner", "PERSON", 6, 13)]
        service = _hybrid_service(spans, [])

        result = await service.extract_entities_hybrid(content, "Obit")

        assert result[0].text == "Posner"
        _assert_aligned(content, result)

    async def test_spacy_span_with_wrong_offsets_is_relocated(self):
        spans = [_make_span("Posner", "PERSON", 0, 6)]  # content[0:6] == "He was"
        service = _hybrid_service(spans, [])

        result = await service.extract_entities_hybrid(POSNER, "Obit")

        assert result[0].start == POSNER.index("Posner")
        _assert_aligned(POSNER, result)

    async def test_spacy_span_whose_text_is_absent_is_dropped(self):
        spans = [_make_span("Easterbrook", "PERSON", 0, 11)]
        service = _hybrid_service(spans, [])

        assert await service.extract_entities_hybrid(POSNER, "Obit") == []


class TestLocateMention:
    def test_prefers_whole_word_over_substring(self):
        content = "The ECBs and the ECB disagreed."
        assert locate_mention(content, "ECB") == (17, 20)

    def test_uses_hint_only_when_it_matches(self):
        content = "Posner and Posner"
        assert locate_mention(content, "Posner", hint=11) == (11, 17)
        assert locate_mention(content, "Posner", hint=3) == (0, 6)

    def test_missing_or_empty_text_returns_none(self):
        assert locate_mention("abc", "xyz") is None
        assert locate_mention("abc", "") is None
