from app.clients.pages import excerpt, parse_page

LONG = " ".join(f"word{i}" for i in range(40))


def _html(head: str, body: str) -> str:
    return f"<html><head>{head}</head><body>{body}</body></html>"


def test_prefers_og_image_and_resolves_relative_urls():
    html = _html(
        '<meta name="twitter:image" content="https://cdn.test/tw.jpg">'
        '<meta property="og:image" content="/img/lead.jpg">',
        "<article><p>" + LONG + ".</p></article>",
    )
    page = parse_page(html, "https://news.test/a/story")
    assert page.image_url == "https://news.test/img/lead.jpg"


def test_falls_back_to_twitter_image_then_article_picture():
    tw = parse_page(
        _html('<meta name="twitter:image" content="https://cdn.test/tw.jpg">', ""), "https://x.test"
    )
    assert tw.image_url == "https://cdn.test/tw.jpg"
    body = (
        '<article><img src="/icon.png" width="32"><img src="/photo.jpg">'
        "<p>" + LONG + "</p></article>"
    )
    pic = parse_page(_html("", body), "https://x.test/s")
    assert pic.image_url == "https://x.test/photo.jpg"


def test_keeps_article_paragraphs_and_drops_boilerplate():
    body = (
        "<nav><p>Home News Sport Weather Business Culture Travel Earth</p></nav>"
        "<article>"
        "<p>The council voted on Tuesday to close the bridge for six months of repairs.</p>"
        "<p>Advertisement</p>"
        "<p>Subscribe to our newsletter to get the best stories every single morning.</p>"
        "<figure><p>Photo caption about the bridge at dusk, by a staff photographer.</p></figure>"
        "<p>Commuters will be diverted through the tunnel, adding about twenty minutes.</p>"
        "</article>"
        "<footer><p>Copyright 2026 News Test Limited. All rights reserved worldwide.</p></footer>"
    )
    page = parse_page(_html("", body), "https://news.test")
    assert page.text == (
        "The council voted on Tuesday to close the bridge for six months of repairs.\n\n"
        "Commuters will be diverted through the tunnel, adding about twenty minutes."
    )
    assert page.word_count == len(page.text.split())


def test_without_an_article_element_uses_the_densest_container():
    body = (
        "<div class='promo'><p>Read more about our award-winning coverage of the city.</p></div>"
        "<div class='story'>"
        "<p>Officials confirmed the new rail line will open to passengers next spring.</p>"
        "<p>The line links the airport to the centre and cost four billion dollars.</p>"
        "</div>"
    )
    page = parse_page(_html("", body), "https://news.test")
    assert page.text.startswith("Officials confirmed")
    assert "award-winning" not in page.text


def test_excerpt_stops_at_the_word_limit_on_a_sentence():
    first = "One two three four five six seven eight nine ten."  # 10 words
    second = "Alpha beta gamma delta epsilon. Zeta eta theta iota kappa lambda mu nu."  # 13 words
    assert excerpt([first, second], max_words=10) == first
    assert excerpt([first, second], max_words=20) == first + "\n\nAlpha beta gamma delta epsilon."
    assert excerpt([first, second], max_words=30) == first + "\n\n" + second


def test_excerpt_of_one_long_paragraph_is_capped():
    para = " ".join(["This is a sentence of eight words."] * 60)  # 420 words
    out = excerpt([para])
    assert len(out.split()) <= 300
    assert out.endswith(".")


def test_includes_a_lead_paragraph_kept_outside_the_main_text_block():
    body = (
        "<div id='story'>"
        "<p id='first'>For some children, learning maths is much harder than for their peers.</p>"
        "<div class='text'>"
        "<p>One possible explanation lies in how the brain selects and manages strategies.</p>"
        "<p>The findings come from research led by a team that studied sixty-eight children.</p>"
        "<p>Children were scanned while solving simple sums, and their choices were logged.</p>"
        "<p>Those who struggled kept using slow strategies after better ones were shown.</p>"
        "</div></div>"
        "<div class='promo'><p>More stories from our science desk, updated every hour.</p></div>"
    )
    page = parse_page(_html("", body), "https://news.test")
    assert page.text.startswith("For some children")
    assert "science desk" not in page.text
