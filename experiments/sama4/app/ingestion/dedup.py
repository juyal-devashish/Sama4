from datasketch import MinHash, MinHashLSH
from rapidfuzz import fuzz

from app.ingestion.fetcher import FetchedArticle


class DeduplicationService:
    """Deduplicates articles using title similarity and content hashing."""

    def __init__(self) -> None:
        self.title_threshold = 85
        self.content_threshold = 0.8
        self.lsh = MinHashLSH(threshold=self.content_threshold, num_perm=128)
        self._seen_titles: list[str] = []

    def is_duplicate(self, article: FetchedArticle) -> bool:
        """Check if an article is a duplicate.

        Args:
            article: The article to check.

        Returns:
            True if the article is a duplicate.
        """
        # Check 1: Title similarity (fast)
        for existing_title in self._seen_titles:
            similarity = fuzz.ratio(article.title.lower(), existing_title.lower())
            if similarity >= self.title_threshold:
                return True

        # Check 2: Content hash (more accurate)
        if article.raw_content:
            article_minhash = self._compute_minhash(article.raw_content)
            try:
                result = self.lsh.query(article_minhash)
                if result:
                    return True
                # Add to LSH index
                self.lsh.insert(article.url, article_minhash)
            except ValueError:
                pass

        self._seen_titles.append(article.title)
        return False

    def _compute_minhash(self, content: str) -> MinHash:
        """Compute MinHash signature for content."""
        minhash = MinHash(num_perm=128)
        words = content.lower().split()
        for word in words:
            minhash.update(word.encode("utf-8"))
        return minhash
