"""Tests for EntityLinkerService — NER + Wikidata enrichment pipeline.

All external calls (spaCy, Wikidata API) are mocked.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.ingestion.ner import ExtractedEntity
from app.services.entity_linker import EntityLinkerService, LinkedEntity
from app.services.wikidata import EntityFacts, WikidataSearchResult


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _ent(
    text: str = "Modi",
    entity_type: str = "PERSON",
    start: int = 0,
    end: int = 4,
    in_title: bool = False,
    mention_count: int = 1,
    priority: str = "low",
) -> ExtractedEntity:
    return ExtractedEntity(
        text=text, type=entity_type, start=start, end=end,
        in_title=in_title, mention_count=mention_count, priority=priority,
    )


def _facts(
    qid: str = "Q1058",
    label: str = "Narendra Modi",
    description: str = "Prime Minister of India",
    wikipedia_url: str = "https://en.wikipedia.org/wiki/Narendra_Modi",
    facts: dict | None = None,
) -> EntityFacts:
    return EntityFacts(
        qid=qid, label=label, description=description,
        wikipedia_url=wikipedia_url,
        facts=facts or {"date_of_birth": "17 September 1950", "citizenship": "India"},
    )


@pytest.fixture
def mock_ner():
    ner = MagicMock()
    ner.extract = AsyncMock(return_value=[])
    return ner


@pytest.fixture
def mock_wikidata():
    wd = MagicMock()
    wd.search_and_get_facts = AsyncMock(return_value=None)
    return wd


@pytest.fixture
def service(mock_ner, mock_wikidata):
    return EntityLinkerService(ner=mock_ner, wikidata=mock_wikidata)


# ---------------------------------------------------------------------------
# 1. extract_and_link — merging NER + Wikidata
# ---------------------------------------------------------------------------

class TestExtractAndLink:

    @pytest.mark.asyncio
    async def test_empty_content_returns_empty(self, service, mock_ner):
        mock_ner.extract.return_value = []
        result = await service.extract_and_link("", "")
        assert result == []

    @pytest.mark.asyncio
    async def test_single_entity_with_facts(self, service, mock_ner, mock_wikidata):
        mock_ner.extract.return_value = [_ent("Modi", "PERSON", 0, 4)]
        mock_wikidata.search_and_get_facts.return_value = _facts()

        result = await service.extract_and_link("Modi spoke today.", "News")

        assert len(result) == 1
        assert result[0].text == "Modi"
        assert result[0].entity_type == "PERSON"
        assert result[0].wikidata_id == "Q1058"
        assert result[0].wikipedia_url == "https://en.wikipedia.org/wiki/Narendra_Modi"
        assert result[0].description == "Prime Minister of India"
        assert result[0].facts["date_of_birth"] == "17 September 1950"
        assert result[0].facts["citizenship"] == "India"

    @pytest.mark.asyncio
    async def test_entity_without_wikidata_match(self, service, mock_ner, mock_wikidata):
        mock_ner.extract.return_value = [_ent("Xyzzy Corp", "ORG")]
        mock_wikidata.search_and_get_facts.return_value = None

        result = await service.extract_and_link("Xyzzy Corp announced.", "News")

        assert len(result) == 1
        assert result[0].text == "Xyzzy Corp"
        assert result[0].wikidata_id is None
        assert result[0].wikipedia_url is None
        assert result[0].facts == {}

    @pytest.mark.asyncio
    async def test_wikidata_error_gracefully_handled(self, service, mock_ner, mock_wikidata):
        """If Wikidata raises, entity is still returned without enrichment."""
        mock_ner.extract.return_value = [_ent("NASA", "ORG")]
        mock_wikidata.search_and_get_facts.side_effect = Exception("timeout")

        result = await service.extract_and_link("NASA launched.", "Space")

        assert len(result) == 1
        assert result[0].text == "NASA"
        assert result[0].wikidata_id is None


# ---------------------------------------------------------------------------
# 2. Concurrent processing
# ---------------------------------------------------------------------------

class TestConcurrentProcessing:

    @pytest.mark.asyncio
    async def test_multiple_entities_processed_concurrently(self, mock_ner, mock_wikidata):
        """All entities should be enriched via asyncio.gather."""
        entities = [
            _ent("Modi", "PERSON", 0, 4),
            _ent("NASA", "ORG", 10, 14),
            _ent("London", "LOCATION", 20, 26),
        ]
        mock_ner.extract.return_value = entities

        call_order = []

        async def fake_search(name, entity_type):
            call_order.append(name)
            await asyncio.sleep(0.01)  # simulate I/O
            return _facts(qid=f"Q{len(call_order)}", label=name, description=f"desc-{name}", facts={})

        mock_wikidata.search_and_get_facts = fake_search

        service = EntityLinkerService(ner=mock_ner, wikidata=mock_wikidata)
        result = await service.extract_and_link("content", "title")

        assert len(result) == 3
        # All three should have been called (order may vary due to concurrency)
        assert set(call_order) == {"Modi", "NASA", "London"}

    @pytest.mark.asyncio
    async def test_semaphore_limits_concurrency(self, mock_ner, mock_wikidata):
        """With max_concurrent=2, at most 2 API calls run simultaneously."""
        entities = [_ent(f"Entity{i}", "PERSON", i * 10, i * 10 + 5) for i in range(5)]
        mock_ner.extract.return_value = entities

        max_active = 0
        active = 0
        lock = asyncio.Lock()

        async def tracking_search(name, entity_type):
            nonlocal active, max_active
            async with lock:
                active += 1
                max_active = max(max_active, active)
            await asyncio.sleep(0.02)
            async with lock:
                active -= 1
            return _facts(qid="Q1", label=name, description="", facts={})

        mock_wikidata.search_and_get_facts = tracking_search

        service = EntityLinkerService(ner=mock_ner, wikidata=mock_wikidata, max_concurrent=2)
        result = await service.extract_and_link("content", "title")

        assert len(result) == 5
        assert max_active <= 2

    @pytest.mark.asyncio
    async def test_partial_failure_returns_all_entities(self, mock_ner, mock_wikidata):
        """If some entities fail Wikidata lookup, they're still in the result."""
        entities = [
            _ent("Good", "PERSON", 0, 4),
            _ent("Bad", "ORG", 10, 13),
            _ent("Ugly", "LOCATION", 20, 24),
        ]
        mock_ner.extract.return_value = entities

        call_count = 0

        async def flaky_search(name, entity_type):
            nonlocal call_count
            call_count += 1
            if name == "Bad":
                raise ConnectionError("network down")
            return _facts(qid=f"Q{call_count}", label=name, description=f"desc-{name}", facts={})

        mock_wikidata.search_and_get_facts = flaky_search

        service = EntityLinkerService(ner=mock_ner, wikidata=mock_wikidata)
        result = await service.extract_and_link("content", "title")

        assert len(result) == 3
        enriched = [r for r in result if r.wikidata_id is not None]
        unenriched = [r for r in result if r.wikidata_id is None]
        assert len(enriched) == 2
        assert len(unenriched) == 1
        assert unenriched[0].text == "Bad"


# ---------------------------------------------------------------------------
# 3. LinkedEntity merge logic
# ---------------------------------------------------------------------------

class TestMerge:

    def test_merge_with_facts(self):
        ent = _ent("Modi", "PERSON", 5, 9, in_title=True, mention_count=3, priority="high")
        facts = _facts()

        result = EntityLinkerService._merge(ent, facts)

        assert result.text == "Modi"
        assert result.entity_type == "PERSON"
        assert result.start == 5
        assert result.end == 9
        assert result.in_title is True
        assert result.mention_count == 3
        assert result.priority == "high"
        assert result.wikidata_id == "Q1058"
        assert result.wikipedia_url is not None
        assert result.description == "Prime Minister of India"
        assert "date_of_birth" in result.facts

    def test_merge_without_facts(self):
        ent = _ent("Unknown Corp", "ORG")

        result = EntityLinkerService._merge(ent, None)

        assert result.text == "Unknown Corp"
        assert result.entity_type == "ORG"
        assert result.wikidata_id is None
        assert result.wikipedia_url is None
        assert result.description is None
        assert result.facts == {}

    def test_merge_preserves_all_ner_fields(self):
        ent = _ent("London", "LOCATION", 42, 48, in_title=False, mention_count=2, priority="medium")
        facts = _facts(qid="Q84", label="London", description="capital of England",
                       wikipedia_url="https://en.wikipedia.org/wiki/London",
                       facts={"country": "United Kingdom", "population": "8982000"})

        result = EntityLinkerService._merge(ent, facts)

        assert result.start == 42
        assert result.end == 48
        assert result.mention_count == 2
        assert result.priority == "medium"
        assert result.facts["population"] == "8982000"


# ---------------------------------------------------------------------------
# 4. LinkedEntity dataclass
# ---------------------------------------------------------------------------

class TestLinkedEntityDataclass:

    def test_defaults(self):
        le = LinkedEntity(
            text="Test", entity_type="CONCEPT", start=0, end=4,
            in_title=False, mention_count=1, priority="low",
        )
        assert le.wikidata_id is None
        assert le.wikipedia_url is None
        assert le.description is None
        assert le.facts == {}

    def test_with_all_fields(self):
        le = LinkedEntity(
            text="NASA", entity_type="ORG", start=0, end=4,
            in_title=True, mention_count=5, priority="high",
            wikidata_id="Q23548",
            wikipedia_url="https://en.wikipedia.org/wiki/NASA",
            description="American space agency",
            facts={"founded": "29 July 1958", "headquarters": "Washington, D.C."},
        )
        assert le.wikidata_id == "Q23548"
        assert le.facts["founded"] == "29 July 1958"


# ---------------------------------------------------------------------------
# 5. DB persistence (mock AsyncSession)
# ---------------------------------------------------------------------------

class TestPersistence:

    @pytest.mark.asyncio
    async def test_extract_link_and_store_calls_commit(self, mock_ner, mock_wikidata):
        """Full pipeline should commit to DB."""
        mock_ner.extract.return_value = [_ent("Modi", "PERSON")]
        mock_wikidata.search_and_get_facts.return_value = _facts()

        # Mock AsyncSession — use MagicMock for sync methods, AsyncMock for async
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_db.commit = AsyncMock()

        # entity doesn't exist in DB yet
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        service = EntityLinkerService(ner=mock_ner, wikidata=mock_wikidata)

        import uuid as uuid_mod
        await service.extract_link_and_store(uuid_mod.uuid4(), "Modi spoke.", "News", mock_db)

        mock_db.commit.assert_awaited_once()
        assert mock_db.add.call_count >= 2  # Entity + ArticleEntity

    @pytest.mark.asyncio
    async def test_existing_entity_gets_updated_with_wikidata(self, mock_ner, mock_wikidata):
        """If entity exists in DB without wikidata_id, it should be updated."""
        mock_ner.extract.return_value = [_ent("NASA", "ORG")]
        mock_wikidata.search_and_get_facts.return_value = _facts(
            qid="Q23548", label="NASA", description="space agency",
            wikipedia_url="https://en.wikipedia.org/wiki/NASA", facts={},
        )

        existing_entity = MagicMock()
        existing_entity.id = MagicMock()
        existing_entity.wikidata_id = None
        existing_entity.wikipedia_url = None
        existing_entity.short_context = None
        existing_entity.popularity_score = 5

        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing_entity
        mock_db.execute.return_value = mock_result

        service = EntityLinkerService(ner=mock_ner, wikidata=mock_wikidata)

        import uuid as uuid_mod
        await service.extract_link_and_store(uuid_mod.uuid4(), "NASA launched.", "Space", mock_db)

        assert existing_entity.wikidata_id == "Q23548"
        assert existing_entity.wikipedia_url == "https://en.wikipedia.org/wiki/NASA"
        assert existing_entity.short_context == "space agency"
        assert existing_entity.popularity_score == 6

    @pytest.mark.asyncio
    async def test_existing_entity_not_overwritten(self, mock_ner, mock_wikidata):
        """If entity already has wikidata fields, don't overwrite them."""
        mock_ner.extract.return_value = [_ent("NASA", "ORG")]
        mock_wikidata.search_and_get_facts.return_value = _facts(
            qid="Q99999", label="Wrong NASA",
            description="wrong", wikipedia_url="https://wrong.example.com", facts={},
        )

        existing_entity = MagicMock()
        existing_entity.id = MagicMock()
        existing_entity.wikidata_id = "Q23548"
        existing_entity.wikipedia_url = "https://en.wikipedia.org/wiki/NASA"
        existing_entity.short_context = "American space agency"
        existing_entity.popularity_score = 10

        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing_entity
        mock_db.execute.return_value = mock_result

        service = EntityLinkerService(ner=mock_ner, wikidata=mock_wikidata)

        import uuid as uuid_mod
        await service.extract_link_and_store(uuid_mod.uuid4(), "NASA launched.", "Space", mock_db)

        # Should NOT be overwritten
        assert existing_entity.wikidata_id == "Q23548"
        assert existing_entity.wikipedia_url == "https://en.wikipedia.org/wiki/NASA"
        assert existing_entity.short_context == "American space agency"

    @pytest.mark.asyncio
    async def test_empty_extraction_skips_db(self, service, mock_ner):
        mock_ner.extract.return_value = []
        mock_db = MagicMock()
        mock_db.commit = AsyncMock()

        import uuid as uuid_mod
        result = await service.extract_link_and_store(uuid_mod.uuid4(), "", "", mock_db)

        assert result == []
        mock_db.commit.assert_not_awaited()
