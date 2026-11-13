"""RSS feeds the pipeline reads.

`category` is the reader-facing topic stored on the article. `region` tells the ranker
where a story is from (us / india / world / tech) so it can apply the tie-break order;
`offbeat` feeds exist mainly to supply well-reported stories outside that order.
Every feed here was checked to return dated items from the last 24 hours.
"""

NEWS_SOURCES = [
    # ---- United States: major newsrooms ----
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
    {
        "name": "Washington Post",
        "url": "https://feeds.washingtonpost.com/rss/national",
        "category": "general",
        "region": "us",
    },
    {
        "name": "NPR",
        "url": "https://feeds.npr.org/1001/rss.xml",
        "category": "general",
        "region": "us",
    },
    {
        "name": "The Guardian",
        "url": "https://www.theguardian.com/us-news/rss",
        "category": "general",
        "region": "us",
    },
    {
        "name": "CNBC",
        "url": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
        "category": "business",
        "region": "us",
    },
    {
        "name": "Bloomberg",
        "url": "https://feeds.bloomberg.com/markets/news.rss",
        "category": "business",
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
        "name": "Hindustan Times",
        "url": "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
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
        "name": "Mint",
        "url": "https://www.livemint.com/rss/news",
        "category": "business",
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
        "url": "https://feeds.bbci.co.uk/news/world/rss.xml",
        "category": "world",
        "region": "world",
    },
    {
        "name": "The Guardian",
        "url": "https://www.theguardian.com/world/rss",
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
        "name": "Financial Times",
        "url": "https://www.ft.com/rss/home",
        "category": "business",
        "region": "world",
    },
    # ---- Tech and AI ----
    {
        "name": "TechCrunch",
        "url": "https://techcrunch.com/feed/",
        "category": "tech",
        "region": "tech",
    },
    {
        "name": "Ars Technica",
        "url": "https://feeds.arstechnica.com/arstechnica/index",
        "category": "tech",
        "region": "tech",
    },
    {
        "name": "The Verge",
        "url": "https://www.theverge.com/rss/index.xml",
        "category": "tech",
        "region": "tech",
    },
    {
        "name": "MIT Technology Review",
        "url": "https://www.technologyreview.com/feed/",
        "category": "tech",
        "region": "tech",
    },
    {
        "name": "The Guardian",
        "url": "https://www.theguardian.com/technology/artificialintelligenceai/rss",
        "category": "tech",
        "region": "tech",
    },
    {
        "name": "Wired",
        "url": "https://www.wired.com/feed/category/business/latest/rss",
        "category": "tech",
        "region": "tech",
    },
    # ---- Beyond the usual: well-reported desks the order above would skip ----
    {
        "name": "BBC",
        "url": "https://feeds.bbci.co.uk/news/world/africa/rss.xml",
        "category": "world",
        "region": "world",
        "offbeat": True,
    },
    {
        "name": "BBC",
        "url": "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml",
        "category": "world",
        "region": "world",
        "offbeat": True,
    },
    {
        "name": "The Guardian",
        "url": "https://www.theguardian.com/global-development/rss",
        "category": "world",
        "region": "world",
        "offbeat": True,
    },
    {
        "name": "South China Morning Post",
        "url": "https://www.scmp.com/rss/91/feed",
        "category": "world",
        "region": "world",
        "offbeat": True,
    },
    {
        "name": "Rest of World",
        "url": "https://restofworld.org/feed/latest/",
        "category": "tech",
        "region": "world",
        "offbeat": True,
    },
    {
        "name": "Science Daily",
        "url": "https://www.sciencedaily.com/rss/all.xml",
        "category": "science",
        "region": "world",
        "offbeat": True,
    },
]
