"""RSS feeds the pipeline reads.

`category` is the reader-facing topic stored on the article. `region` tells the ranker
where a story is from (us / india / world / tech) so it can apply the tie-break order.

Ten outlets, chosen by the makers (2026-11-13). Every feed here was checked to return
dated items from the last 24 hours. A feed may also set `offbeat: True` to mark a desk
that mainly supplies well-reported stories outside the usual order; none does now.
Terms of use for each outlet: docs/feed-terms.md.
"""

NEWS_SOURCES = [
    # ---- United States ----
    {
        "name": "PBS NewsHour",
        "url": "https://www.pbs.org/newshour/feeds/rss/headlines",
        "category": "general",
        "region": "us",
    },
    {
        "name": "NYT",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
        "category": "general",
        "region": "us",
    },
    {
        "name": "NYT",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/US.xml",
        "category": "general",
        "region": "us",
    },
    # ---- India ----
    {
        "name": "The Hindu",
        "url": "https://www.thehindu.com/news/national/feeder/default.rss",
        "category": "world",
        "region": "india",
    },
    {
        "name": "Indian Express",
        "url": "https://indianexpress.com/section/india/feed/",
        "category": "world",
        "region": "india",
    },
    {
        "name": "Indian Express",
        "url": "https://indianexpress.com/section/explained/feed/",
        "category": "world",
        "region": "india",
    },
    # ---- World ----
    {
        "name": "NYT",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        "category": "world",
        "region": "world",
    },
    {
        "name": "BBC",
        "url": "https://feeds.bbci.co.uk/news/rss.xml",
        "category": "world",
        "region": "world",
    },
    {
        "name": "Al Jazeera",
        "url": "https://www.aljazeera.com/xml/rss/all.xml",
        "category": "world",
        "region": "world",
    },
    {
        "name": "The Economist",
        "url": "https://www.economist.com/latest/rss.xml",
        "category": "world",
        "region": "world",
    },
    # ---- Business and markets ----
    {
        "name": "Bloomberg",
        "url": "https://feeds.bloomberg.com/markets/news.rss",
        "category": "business",
        "region": "us",
    },
    {
        "name": "Financial Times",
        "url": "https://www.ft.com/rss/home",
        "category": "business",
        "region": "world",
    },
    # ---- Tech ----
    {
        "name": "Bloomberg",
        "url": "https://feeds.bloomberg.com/technology/news.rss",
        "category": "tech",
        "region": "tech",
    },
    {
        "name": "MIT Technology Review",
        "url": "https://www.technologyreview.com/feed/",
        "category": "tech",
        "region": "tech",
    },
]
