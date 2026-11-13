"""Read an article's own page: its lead image and the opening of its text.

Used by the ingestion pipeline. RSS feeds often carry only a teaser and no image; the
publisher's page nearly always declares a lead image (`og:image` / `twitter:image`) and
holds the article text, so the pipeline reads it once per picked story. We keep only an
excerpt (`EXCERPT_WORDS`), never the whole article. Paywalled or blocked pages yield
nothing, and the feed's own text and image stay.
"""

import logging
import re
from dataclasses import dataclass
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup, Tag

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (compatible; sama4-news/1.0; +https://www.sama4.online)"

EXCERPT_WORDS = 300
# Shorter paragraphs are usually captions, bylines, share prompts or "Read more" links.
MIN_PARAGRAPH_WORDS = 8
_BOILERPLATE = re.compile(
    r"^(advertisement|sign up|subscribe|read more|related:|follow us|click here|"
    r"this article|image:|photo:|copyright|©|all rights reserved)",
    re.IGNORECASE,
)
_SENTENCE_END = re.compile(r"[.!?][\"'”’)]?(?=\s|$)")


@dataclass
class PageContent:
    image_url: str | None
    text: str  # the excerpt we keep: opening paragraphs joined by blank lines
    word_count: int = 0  # length of the whole article, for the reading time


def _image(soup: BeautifulSoup, base_url: str) -> str | None:
    for attrs in (
        {"property": "og:image"},
        {"property": "og:image:url"},
        {"name": "twitter:image"},
        {"name": "twitter:image:src"},
        {"itemprop": "image"},
    ):
        tag = soup.find("meta", attrs=attrs)
        content = tag.get("content") if isinstance(tag, Tag) else None
        if isinstance(content, str) and content.strip():
            return urljoin(base_url, content.strip())
    link = soup.find("link", attrs={"rel": "image_src"})
    href = link.get("href") if isinstance(link, Tag) else None
    if isinstance(href, str) and href.strip():
        return urljoin(base_url, href.strip())
    # Last resort: the first sizeable picture inside the article body.
    scope = soup.find("article") or soup
    for img in scope.find_all("img"):
        src = img.get("src") or img.get("data-src")
        if not isinstance(src, str) or src.startswith("data:"):
            continue
        width = str(img.get("width") or "")
        if width.isdigit() and int(width) < 200:
            continue
        return urljoin(base_url, src)
    return None


def _paragraph_words(el: Tag) -> int:
    return sum(len(p.get_text(" ", strip=True).split()) for p in el.find_all("p"))


def _paragraphs(soup: BeautifulSoup) -> list[str]:
    for el in soup(["script", "style", "nav", "footer", "header", "aside", "figure", "form"]):
        el.decompose()
    # Prefer the article element; otherwise the container holding the most paragraph text.
    candidates = soup.find_all("article") or []
    if not candidates:
        containers: dict[int, tuple[Tag, int]] = {}
        for p in soup.find_all("p"):
            parent = p.parent
            if isinstance(parent, Tag):
                words = len(p.get_text(" ", strip=True).split())
                tag, total = containers.get(id(parent), (parent, 0))
                containers[id(parent)] = (tag, total + words)
        if containers:
            best = max(containers.values(), key=lambda t: t[1])[0]
            # Widen to the parent while the best block is most of the parent's paragraph
            # text: some sites keep the lead paragraph outside the main text block.
            while isinstance(best.parent, Tag) and best.parent.name not in ("body", "html"):
                inner = _paragraph_words(best)
                if inner < 0.75 * _paragraph_words(best.parent):
                    break
                best = best.parent
            candidates = [best]
    scope = max(candidates, key=lambda el: len(el.get_text(" ", strip=True).split()), default=soup)

    out: list[str] = []
    seen: set[str] = set()
    for p in scope.find_all("p"):
        text = re.sub(r"\s+", " ", p.get_text(" ", strip=True)).strip()
        if len(text.split()) < MIN_PARAGRAPH_WORDS or _BOILERPLATE.match(text) or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


def excerpt(paragraphs: list[str], max_words: int = EXCERPT_WORDS) -> str:
    """The opening paragraphs, up to `max_words`, ending on a whole sentence when possible."""
    kept: list[str] = []
    used = 0
    for para in paragraphs:
        words = para.split()
        if used + len(words) <= max_words:
            kept.append(para)
            used += len(words)
            continue
        room = max_words - used
        if room >= MIN_PARAGRAPH_WORDS:
            partial = " ".join(words[:room])
            ends = list(_SENTENCE_END.finditer(partial))
            if ends:
                kept.append(partial[: ends[-1].end()])
        break
    return "\n\n".join(kept)


def parse_page(html: str, base_url: str, max_words: int = EXCERPT_WORDS) -> PageContent:
    soup = BeautifulSoup(html, "lxml")
    image = _image(soup, base_url)
    paragraphs = _paragraphs(soup)
    return PageContent(
        image_url=image,
        text=excerpt(paragraphs, max_words),
        word_count=sum(len(p.split()) for p in paragraphs),
    )


class PageFetcher:
    """Fetches an article page. Network errors and non-HTML responses return None."""

    def __init__(self, timeout: float = 20.0) -> None:
        self.timeout = timeout

    async def fetch(self, url: str) -> PageContent | None:
        if not url:
            return None
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                headers={"User-Agent": USER_AGENT, "Accept": "text/html"},
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.info("Could not read article page %s: %s", url, exc)
            return None
        if "html" not in response.headers.get("content-type", "html"):
            return None
        try:
            return parse_page(response.text, str(response.url))
        except Exception:
            logger.warning("Could not parse article page %s", url, exc_info=True)
            return None
