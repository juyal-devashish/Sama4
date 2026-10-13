from app.ingestion.dedup import DeduplicationService
from app.ingestion.fetcher import FetchedArticle


def _make_article(
    title: str = "Test Article",
    url: str = "https://example.com/test",
    content: str = "Some content here",
) -> FetchedArticle:
    return FetchedArticle(
        url=url,
        title=title,
        raw_content=content,
        image_url=None,
        author=None,
        published_at=None,
        source_name="Test",
        category="general",
    )


def test_dedup_detects_similar_titles():
    dedup = DeduplicationService()
    article1 = _make_article("Breaking: Major Event Happens Today", "https://a.com/1")
    article2 = _make_article("Breaking: Major Event Happens Today!", "https://a.com/2")

    assert dedup.is_duplicate(article1) is False
    assert dedup.is_duplicate(article2) is True


def test_dedup_allows_different_articles():
    dedup = DeduplicationService()
    article1 = _make_article(
        "First Article About Topic A",
        "https://a.com/1",
        "The government announced new climate policy measures today targeting carbon emissions",
    )
    article2 = _make_article(
        "Second Article About Topic B",
        "https://a.com/2",
        "Tech giant unveils revolutionary quantum computing chip at annual conference",
    )

    assert dedup.is_duplicate(article1) is False
    assert dedup.is_duplicate(article2) is False
