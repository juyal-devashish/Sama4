from app.ingestion.blocklist import allowed_sources, is_blocked, parse_domains


def test_parse_domains_normalizes_input():
    assert parse_domains(" FT.com, https://www.bloomberg.com/markets ,, ") == {
        "ft.com",
        "bloomberg.com",
    }
    assert parse_domains("") == frozenset()


def test_blocks_the_domain_and_its_subdomains_but_not_look_alikes():
    blocked = parse_domains("ft.com")
    assert is_blocked("https://www.ft.com/content/abc", blocked)
    assert is_blocked("https://ft.com/x", blocked)
    assert not is_blocked("https://myft.com/x", blocked)
    assert not is_blocked("https://ft.com.evil.test/x", blocked)
    assert not is_blocked("not a url", blocked)


def test_allowed_sources_drops_blocked_feeds():
    feeds = [{"url": "https://www.ft.com/rss/home"}, {"url": "https://feeds.bbci.co.uk/x"}]
    assert allowed_sources(feeds, parse_domains("ft.com")) == [feeds[1]]
