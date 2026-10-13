import hashlib
import re

from bs4 import BeautifulSoup


class CleanerService:
    """Cleans HTML content and extracts plain text."""

    def clean(self, html_content: str) -> str:
        """Extract clean text from HTML.

        Args:
            html_content: Raw HTML content.

        Returns:
            Cleaned plain text.
        """
        soup = BeautifulSoup(html_content, "lxml")

        # Remove script and style elements
        for element in soup(["script", "style", "nav", "footer", "header"]):
            element.decompose()

        text = soup.get_text(separator=" ")

        # Collapse whitespace
        text = re.sub(r"\s+", " ", text).strip()

        return text

    def compute_hash(self, content: str) -> str:
        """Compute SHA-256 hash of content for deduplication.

        Args:
            content: Text content to hash.

        Returns:
            Hex digest of the hash.
        """
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def estimate_reading_time(self, text: str, wpm: int = 250) -> int:
        """Estimate reading time in minutes.

        Args:
            text: Article text.
            wpm: Words per minute reading speed.

        Returns:
            Estimated reading time in minutes (minimum 1).
        """
        word_count = len(text.split())
        return max(1, round(word_count / wpm))
