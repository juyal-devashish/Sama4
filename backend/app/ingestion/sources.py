"""RSS feeds the pipeline reads.

`category` is the reader-facing topic stored on the article. `region` tells the ranker
where a story is from (us / india / world / tech) so it can apply the tie-break order.

Ten outlets, chosen by the makers (2026-11-13). Every feed here was checked to return
dated items from the last 24 hours. A feed may also set `offbeat: True` to mark a desk
that mainly supplies well-reported stories outside the usual order; none does now.
Terms of use for each outlet: docs/feed-terms.md.

`excerpt_words` is the most article text an outlet's terms let Samā4 show. 0 (the
default) means its terms allow only what the feed itself carries: the article page is
never fetched, and the reader shows the feed's own text and image. A positive number
lets the pipeline read the page and keep at most that many words of its opening.
"""


def excerpt_limit(source: dict | None) -> int:
    """Words of article text Samā4 may show for a feed; 0 = the feed's own text only."""
    return int((source or {}).get("excerpt_words", 0))


NEWS_SOURCES = [
    # ---- United States ----
    {
        "name": "PBS NewsHour",
        "url": "https://www.pbs.org/newshour/feeds/rss/headlines",
        "category": "general",
        "region": "us",
        "excerpt_words": 0,
    },
    {
        "name": "NYT",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
        "category": "general",
        "region": "us",
        "excerpt_words": 0,
    },
    {
        "name": "NYT",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/US.xml",
        "category": "general",
        "region": "us",
        "excerpt_words": 0,
    },
    # ---- India ----
    {
        "name": "The Hindu",
        "url": "https://www.thehindu.com/news/national/feeder/default.rss",
        "category": "world",
        "region": "india",
        "excerpt_words": 0,
    },
    {
        "name": "Indian Express",
        "url": "https://indianexpress.com/section/india/feed/",
        "category": "world",
        "region": "india",
        "excerpt_words": 0,
    },
    {
        "name": "Indian Express",
        "url": "https://indianexpress.com/section/explained/feed/",
        "category": "world",
        "region": "india",
        "excerpt_words": 0,
    },
    # ---- World ----
    {
        "name": "NYT",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        "category": "world",
        "region": "world",
        "excerpt_words": 0,
    },
    {
        "name": "BBC",
        "url": "https://feeds.bbci.co.uk/news/rss.xml",
        "category": "world",
        "region": "world",
        "excerpt_words": 0,
    },
    {
        "name": "Al Jazeera",
        "url": "https://www.aljazeera.com/xml/rss/all.xml",
        "category": "world",
        "region": "world",
        "excerpt_words": 0,
    },
    {
        "name": "The Economist",
        "url": "https://www.economist.com/latest/rss.xml",
        "category": "world",
        "region": "world",
        "excerpt_words": 0,
    },
    # ---- Business and markets ----
    {
        "name": "Bloomberg",
        "url": "https://feeds.bloomberg.com/markets/news.rss",
        "category": "business",
        "region": "us",
        "excerpt_words": 0,
    },
    {
        "name": "Financial Times",
        "url": "https://www.ft.com/rss/home",
        "category": "business",
        "region": "world",
        "excerpt_words": 0,
    },
    # ---- Tech ----
    {
        "name": "Bloomberg",
        "url": "https://feeds.bloomberg.com/technology/news.rss",
        "category": "tech",
        "region": "tech",
        "excerpt_words": 0,
    },
    {
        "name": "MIT Technology Review",
        "url": "https://www.technologyreview.com/feed/",
        "category": "tech",
        "region": "tech",
        "excerpt_words": 0,
    },
]
