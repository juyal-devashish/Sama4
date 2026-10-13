"""Tests for BatchEmbeddingService — batch OpenAI + Pinecone pipeline.

All external calls (OpenAI, Pinecone) are mocked.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.embeddings import (
    ArticleEmbedInput,
    BatchEmbeddingService,
    EmbedResult,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _article(
    title: str = "Test Article",
    summary: str = "This is a test summary.",
    source: str = "TestSource",
    categories: list[str] | None = None,
    published_at: str | None = "2026-01-01T00:00:00Z",
) -> ArticleEmbedInput:
    return ArticleEmbedInput(
        article_id=uuid.uuid4(),
        title=title,
        summary=summary,
        source=source,
        categories=categories or ["general"],
        published_at=published_at,
    )


def _mock_embedding_response(embeddings: list[list[float]]):
    """Build a mock OpenAI embeddings.create response."""
    resp = MagicMock()
    data = []
    for i, emb in enumerate(embeddings):
        item = MagicMock()
        item.index = i
        item.embedding = emb
        data.append(item)
    resp.data = data
    return resp


def _make_service(
    openai_client=None,
    pinecone_index=None,
    embed_batch_size: int = 100,
    upsert_batch_size: int = 100,
) -> BatchEmbeddingService:
    """Create service with injected mocks, bypassing _init_clients."""
    svc = object.__new__(BatchEmbeddingService)
    svc._client = openai_client
    svc._index = pinecone_index
    svc._embed_batch_size = embed_batch_size
    svc._upsert_batch_size = upsert_batch_size
    return svc


@pytest.fixture
def mock_openai():
    client = MagicMock()
    client.embeddings = MagicMock()
    client.embeddings.create = AsyncMock()
    return client


@pytest.fixture
def mock_pinecone():
    index = MagicMock()
    index.upsert = MagicMock()
    index.query = MagicMock()
    return index


@pytest.fixture
def service(mock_openai, mock_pinecone):
    return _make_service(mock_openai, mock_pinecone)


# ---------------------------------------------------------------------------
# 1. Single article embedding
# ---------------------------------------------------------------------------

class TestSingleEmbed:

    @pytest.mark.asyncio
    async def test_embed_single_article(self, service, mock_openai, mock_pinecone):
        mock_openai.embeddings.create.return_value = _mock_embedding_response([[0.1, 0.2, 0.3]])

        article = _article()
        result = await service.embed_single(article)

        assert result.success is True
        assert result.article_id == article.article_id
        assert result.vector_id == f"article_{article.article_id}"
        mock_pinecone.upsert.assert_called_once()

    @pytest.mark.asyncio
    async def test_embed_builds_correct_text(self, service, mock_openai):
        mock_openai.embeddings.create.return_value = _mock_embedding_response([[0.1]])

        article = _article(title="Breaking News", summary="Something happened")
        await service.embed_single(article)

        call_args = mock_openai.embeddings.create.call_args
        assert call_args.kwargs["input"] == ["Breaking News. Something happened"]

    @pytest.mark.asyncio
    async def test_embed_stores_metadata(self, service, mock_openai, mock_pinecone):
        mock_openai.embeddings.create.return_value = _mock_embedding_response([[0.1]])

        article = _article(
            title="Title", summary="Summary", source="BBC",
            categories=["politics", "world"], published_at="2026-02-01",
        )
        await service.embed_single(article)

        upsert_call = mock_pinecone.upsert.call_args
        vectors = upsert_call.kwargs["vectors"]
        _, _, metadata = vectors[0]

        assert metadata["title"] == "Title"
        assert metadata["summary"] == "Summary"
        assert metadata["source"] == "BBC"
        assert metadata["categories"] == ["politics", "world"]
        assert metadata["published_at"] == "2026-02-01"

    @pytest.mark.asyncio
    async def test_published_at_none_becomes_empty_string(self, service, mock_openai, mock_pinecone):
        mock_openai.embeddings.create.return_value = _mock_embedding_response([[0.1]])

        article = _article(published_at=None)
        await service.embed_single(article)

        vectors = mock_pinecone.upsert.call_args.kwargs["vectors"]
        assert vectors[0][2]["published_at"] == ""


# ---------------------------------------------------------------------------
# 2. Batch embedding
# ---------------------------------------------------------------------------

class TestBatchEmbed:

    @pytest.mark.asyncio
    async def test_empty_list_returns_empty(self, service):
        result = await service.embed_articles([])
        assert result == []

    @pytest.mark.asyncio
    async def test_batch_of_three(self, service, mock_openai, mock_pinecone):
        articles = [_article(f"Article {i}") for i in range(3)]
        mock_openai.embeddings.create.return_value = _mock_embedding_response(
            [[0.1] * 3, [0.2] * 3, [0.3] * 3]
        )

        results = await service.embed_articles(articles)

        assert len(results) == 3
        assert all(r.success for r in results)
        mock_openai.embeddings.create.assert_awaited_once()  # single batch call
        mock_pinecone.upsert.assert_called_once()  # single upsert batch

    @pytest.mark.asyncio
    async def test_chunked_embedding_calls(self, mock_openai, mock_pinecone):
        """With embed_batch_size=2, 5 articles should produce 3 OpenAI calls."""
        service = _make_service(mock_openai, mock_pinecone, embed_batch_size=2)
        articles = [_article(f"A{i}") for i in range(5)]

        mock_openai.embeddings.create.side_effect = [
            _mock_embedding_response([[0.1], [0.2]]),
            _mock_embedding_response([[0.3], [0.4]]),
            _mock_embedding_response([[0.5]]),
        ]

        results = await service.embed_articles(articles)

        assert len(results) == 5
        assert all(r.success for r in results)
        assert mock_openai.embeddings.create.await_count == 3

    @pytest.mark.asyncio
    async def test_chunked_upsert_calls(self, mock_openai, mock_pinecone):
        """With upsert_batch_size=2, 5 vectors should produce 3 Pinecone calls."""
        service = _make_service(mock_openai, mock_pinecone, upsert_batch_size=2)
        articles = [_article(f"A{i}") for i in range(5)]

        mock_openai.embeddings.create.return_value = _mock_embedding_response(
            [[float(i)] for i in range(5)]
        )

        results = await service.embed_articles(articles)

        assert all(r.success for r in results)
        assert mock_pinecone.upsert.call_count == 3


# ---------------------------------------------------------------------------
# 3. Error handling
# ---------------------------------------------------------------------------

class TestErrorHandling:

    @pytest.mark.asyncio
    async def test_no_openai_client(self, mock_pinecone):
        service = _make_service(openai_client=None, pinecone_index=mock_pinecone)
        articles = [_article()]

        results = await service.embed_articles(articles)

        assert len(results) == 1
        assert results[0].success is False
        assert "OpenAI not configured" in results[0].error

    @pytest.mark.asyncio
    async def test_openai_batch_failure(self, service, mock_openai, mock_pinecone):
        """If an OpenAI batch fails, those articles get error results."""
        mock_openai.embeddings.create.side_effect = Exception("rate limited")

        articles = [_article()]
        results = await service.embed_articles(articles)

        assert len(results) == 1
        assert results[0].success is False
        assert results[0].error == "embedding failed"
        mock_pinecone.upsert.assert_not_called()

    @pytest.mark.asyncio
    async def test_pinecone_upsert_failure(self, service, mock_openai, mock_pinecone):
        """If Pinecone upsert fails, results are marked as failed."""
        mock_openai.embeddings.create.return_value = _mock_embedding_response([[0.1]])
        mock_pinecone.upsert.side_effect = Exception("connection refused")

        articles = [_article()]
        results = await service.embed_articles(articles)

        assert len(results) == 1
        assert results[0].success is False
        assert results[0].error == "Pinecone upsert failed"

    @pytest.mark.asyncio
    async def test_partial_openai_failure(self, mock_openai, mock_pinecone):
        """First batch succeeds, second fails — partial results."""
        service = _make_service(mock_openai, mock_pinecone, embed_batch_size=2)
        articles = [_article(f"A{i}") for i in range(4)]

        mock_openai.embeddings.create.side_effect = [
            _mock_embedding_response([[0.1], [0.2]]),
            Exception("quota exceeded"),
        ]

        results = await service.embed_articles(articles)

        assert len(results) == 4
        succeeded = [r for r in results if r.success]
        failed = [r for r in results if not r.success]
        assert len(succeeded) == 2
        assert len(failed) == 2

    @pytest.mark.asyncio
    async def test_no_pinecone_index_skips_upsert(self, mock_openai):
        """If no Pinecone index, embedding still succeeds (no upsert)."""
        service = _make_service(openai_client=mock_openai, pinecone_index=None)
        mock_openai.embeddings.create.return_value = _mock_embedding_response([[0.1]])

        articles = [_article()]
        results = await service.embed_articles(articles)

        assert len(results) == 1
        assert results[0].success is True  # embedding succeeded, just no upsert


# ---------------------------------------------------------------------------
# 4. Search
# ---------------------------------------------------------------------------

class TestSearch:

    @pytest.mark.asyncio
    async def test_search_returns_matches(self, service, mock_openai, mock_pinecone):
        mock_openai.embeddings.create.return_value = _mock_embedding_response([[0.1, 0.2]])

        match1 = MagicMock()
        match1.id = "article_abc"
        match1.score = 0.95
        match1.metadata = {"title": "Matching Article"}
        mock_result = MagicMock()
        mock_result.matches = [match1]
        mock_pinecone.query.return_value = mock_result

        results = await service.search("test query", top_k=3)

        assert len(results) == 1
        assert results[0]["id"] == "article_abc"
        assert results[0]["score"] == 0.95
        mock_pinecone.query.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_no_client(self):
        service = _make_service(openai_client=None, pinecone_index=None)
        results = await service.search("query")
        assert results == []

    @pytest.mark.asyncio
    async def test_search_embedding_fails(self, service, mock_openai):
        mock_openai.embeddings.create.side_effect = Exception("error")
        results = await service.search("query")
        assert results == []


# ---------------------------------------------------------------------------
# 5. available property
# ---------------------------------------------------------------------------

class TestAvailable:

    def test_available_when_both_configured(self, mock_openai, mock_pinecone):
        service = _make_service(mock_openai, mock_pinecone)
        assert service.available is True

    def test_not_available_no_openai(self, mock_pinecone):
        service = _make_service(openai_client=None, pinecone_index=mock_pinecone)
        assert service.available is False

    def test_not_available_no_pinecone(self, mock_openai):
        service = _make_service(openai_client=mock_openai, pinecone_index=None)
        assert service.available is False


# ---------------------------------------------------------------------------
# 6. Dataclasses
# ---------------------------------------------------------------------------

class TestDataclasses:

    def test_article_embed_input_defaults(self):
        a = ArticleEmbedInput(
            article_id=uuid.uuid4(), title="T", summary="S",
            source="Src", categories=["news"],
        )
        assert a.published_at is None

    def test_embed_result_defaults(self):
        r = EmbedResult(article_id=uuid.uuid4(), vector_id="v1", success=True)
        assert r.error is None

    def test_embed_result_with_error(self):
        r = EmbedResult(article_id=uuid.uuid4(), vector_id="v1", success=False, error="fail")
        assert r.error == "fail"
