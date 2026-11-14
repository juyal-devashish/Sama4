# Feed terms review

Checked 2026-11-13 against the 21 outlets the pipeline read then.

> **Update, 2026-11-13:** the feed list is now ten outlets: PBS NewsHour, NYT, BBC, Al
> Jazeera, The Economist, The Hindu, Indian Express, Bloomberg, Financial Times and MIT
> Technology Review (14 feeds). All ten are reviewed below (PBS NewsHour and The
> Economist were added the same day). Rows for outlets no longer read are kept for
> reference.
>
> **What the app does now:** every outlet's terms allow only what its feed carries, so
> each feed is set to `excerpt_words: 0` in `sources.py`. The pipeline never fetches
> their article pages; the reader shows the feed's own text and image, unaltered, with
> a link to the original. Item c (text to Claude for summaries and explanations) is
> unchanged and is still a decision for the makers. Each outlet's terms of use, RSS terms where they exist, and robots.txt were read
directly. **This is a reading of the terms, not legal advice.** Re-check before any
commercial launch, and whenever a feed is added.

## What Samā4 does with a feed

| | Use | Where in the code |
|---|---|---|
| **a** | Shows the headline, publisher, publish time and a link to the original | feed + story cards |
| **b** | Fetches the article page once (lead image, opening text) and shows up to 300 words of the opening verbatim | `clients/pages.py`, reading pane "From …" |
| **c** | Sends the article text to Claude for the summary and the explanations of names | `ingestion/summarizer.py`, `services/context.py` |

The app is free, has no ads and makes no money today.

## Summary

- **a (headline + link)** is defensible for most outlets **while the app is
  non-commercial**. Almost every set of terms limits use to personal or non-commercial
  purposes. Several add conditions:
  - show feed text unaltered;
  - give a prominent credit and link (NYT also requires a link to its RSS terms);
  - don't archive feed items.
  Commercial use needs a licence from almost everyone.
- **b (fetching the page and showing 300 words) isn't permitted by any outlet's terms.**
  Every outlet with readable terms bans scraping or automated access, and none licenses
  article text beyond what the feed itself carries. FT caps extracts at 30 words and
  teasers at 140 characters.
- **c (article text to an LLM) is explicitly banned** by:
  - NYT ("grounding … retrieval-augmented generation");
  - The Guardian ("with any … artificial intelligence technologies to generate any data or content");
  - Indian Express ("summaries… without written consent", "for use in AI summaries");
  - BBC;
  - FT;
  - Condé Nast (Ars Technica, Wired: "grounding (including through RAG)");
  - Penske Media (The Verge: "train or ground");
  - SCMP ("retrieval-augmented generation");
  - Al Jazeera (text and data mining).
  The other outlets ban it indirectly, through derivative-work, scraping or AI clauses.
- **robots.txt:** 17 of the 21 outlets block Anthropic's crawlers by name (ClaudeBot,
  Claude-User, anthropic-ai and others). Those rules name Anthropic's bots, not Samā4's
  fetcher. The contractual bans on b and c apply whatever user agent the fetcher sends.

**As the app works today, the risk is high or medium-high for 19 outlets and medium for 2**
(Rest of World and ScienceDaily).

## Per outlet

Verdicts: ✓ allowed · ✓* allowed with conditions · ✗ not allowed · ? unclear.

| Outlet | a | b | c | Risk | Terms read | Key point |
|---|---|---|---|---|---|---|
| NYT | ✓* | ✗ | ✗ | high | static01.nyt.com/services/xml/rss/termsconditions.html; help.nytimes.com ToS | Personal or non-commercial blog use only. Show headlines "in the exact form received", with an NYT copyright credit and a link to the RSS terms. ToS 4.1 bans scraping and RAG/grounding. |
| Washington Post | ? | ? | ? | med-high | **not loaded** (403); robots.txt read | Its RSS ToS page (helpcenter.washingtonpost.com, article 115005013827) needs reading in a browser. robots.txt blocks ClaudeBot and anthropic-ai. |
| NPR | ✓* | ✗ | ✗ | med-high | npr.org/about-npr/179876898/terms-of-use | Feeds may be shown in a "personal site or application" or by a 501(c)(3), non-commercially, with "NPR" credit and a link. No derivatives, no modifying, no scraping. |
| The Guardian | ✓* | ✗ | ✗ | high | theguardian.com/help/terms-of-service; /help/feeds; /license.xml | Feeds for personal, non-commercial use. AI use only under a paid licence. The Open Platform API (developer tier) would allow full text non-commercially, but its AI ban remains. |
| CNBC (Versant) | ? | ✗ | ✗ | med-high | cnbc.com/terms; versantmedia.com/terms | Personal, non-commercial use only. "No Data Extraction", "No Repurposing … into any … software application". |
| Bloomberg | ? | ✗ | ✗ | high | bloomberg.com/notices/tos | Non-commercial use. No scraping, no archiving or caching. Even linking is "except as expressly permitted". Paywalled; bot-checks scripts. |
| The Hindu | ✓* | ✗ | ? | med-high | thehindu.com/termsofuse | Non-commercial use with credit. Bans scraping, caching, framing and AI training. Summarising isn't named. |
| Hindustan Times | ? | ✗ | ✗ | high | hindustantimes.com/rss; /terms-of-use | RSS is for "individuals … personal and non-commercial use". No derivatives, no page-scraping. |
| Indian Express | ? | ✗ | ✗ | high | indianexpress.com/rss; /terms-and-conditions | RSS is "strictly for personal and non-commercial use". 9.3.3 / 9.3.7 / 9.3.10 ban summaries and AI summarisation outright. |
| Mint | ? | ✗ | ✗ | high | livemint.com/rss; /static/termsofuse | RSS is for individuals' personal, non-commercial use. No derivatives. Licensing contact for more rights. |
| BBC | ✓* | ✗ | ✗ | high | bbc.co.uk/usingthebbc/terms-of-use; bbc.co.uk/news/10628494 | Feed may go on a site **unchanged**, with a prominent "BBC News" credit and link, no logos and no "plucking metadata". "Business use" includes non-profits. robots.txt: "No RAG … no summaries". |
| Al Jazeera | ? | ✗ | ✗ | high | aljazeera.com/terms-and-conditions | Personal, non-commercial use. No text or data mining, no scraping. Links must go to the full page with no framing. |
| Financial Times | ✓* | ✗ | ✗ | high | help.ft.com/legal-privacy/copyright-policy; /terms-and-conditions | Feed shown "as it is" (headline and a teaser of 140 characters or less), non-commercially, credited "© The Financial Times Limited", **not archived**. AI use banned (3.5). Paywalled. |
| SCMP | ? | ✗ | ✗ | high | scmp.com/terms-conditions (15 Sep 2026) | Bans automated systems that "access, extract, or index … for any purpose", and bans RAG even via third-party sources (i.e. RSS). |
| TechCrunch | ✓* | ✗ | ? | med-high | techcrunch.com/terms-of-service | Personal non-commercial use, no copying or republishing, no scrapers. No AI clause. |
| Ars Technica | ✓* | ✗ | ✗ | high | condenast.com/user-agreement | RSS is "subject to the same terms". Explicit ban on LLM "grounding (including through RAG)". |
| The Verge (Penske) | ✓* | ✗ | ✗ | high | pmc.com/terms-of-use §19 | **Now owned by Penske Media, not Vox.** Feeds used "as provided", unedited, with a direct link and attribution. No AI access or grounding. |
| MIT Technology Review | ✓* | ✗ | ✗ | high | technologyreview.com/terms-of-service | Personal or non-commercial use. No scrapers. Bans use to "enhance … AI services". |
| Wired | ✓* | ✗ | ✗ | high | condenast.com/user-agreement | Same as Ars Technica. |
| PBS NewsHour | ✓ | ? | ? | medium | pbs.org/about/about-pbs/terms-of-use; newshour RSS page | No RSS terms; feeds offered openly. §1 bars commercial use; no scraping or AI clause. Many items are AP wire copy (AP's copyright). Max excerpt: the feed text. |
| The Economist | ✓* | ✗ | ✗ | high | economistgroup.com/terms-of-use (1 Jul 2026) | Terms cover RSS: personal, non-commercial use; no displaying "all or any part" without permission; scraping banned; "use artificial intelligence tools … for the purposes of generating text" banned. Max excerpt: none beyond the feed's one-line standfirst. |
| Rest of World | ✓ | ? | ? | medium | no terms page found (404s); ethics page | **No Creative Commons licence found**; treat as all rights reserved. robots.txt blocks AI agents. |
| ScienceDaily | ✓* | ✗ | ? | medium | sciencedaily.com/terms.htm | Feed free for commercial and non-commercial use if unmodified, credited and linked. **"No Science Daily content may be entered into a database"**, and keep about 40 items or fewer. No AI clause (terms from 2007). |

## What would bring Samā4 within the terms

These are product decisions for the makers. Nothing in the app has been changed because
of this review.

1. **Stop b.** Drop the page fetch and the verbatim excerpt. Show only what the feed
   carries, unaltered, with credit and a direct link. This is the largest single
   reduction in risk.
2. **c needs licences, or other sources.** Summaries and explanations built from article
   text are what the terms most clearly forbid. Options:
   - generate them only from feed text where that's allowed (it isn't for NYT, the
     Guardian, BBC, FT, Condé Nast, Penske or SCMP);
   - license content (NYT Licensing, Guardian, Bloomberg, Versant and others);
   - move towards sources with open terms (wire services under licence, Creative Commons
     outlets).
3. **Per-feed conditions** if the feeds stay:
   - NYT: add a copyright credit and a link to its RSS terms;
   - BBC: "BBC News" credit and link beside its stories;
   - FT: credit and 140-character teasers;
   - FT and ScienceDaily: don't archive (Samā4 stores every story, so these two can't be
     stored).
4. **Before any commercial launch**, get written permission from every outlet kept.
5. **Opt-outs:** `BLOCKED_PUBLISHERS` and `POST /admin/publishers/purge` handle a
   publisher's request to be removed (see AGENTS.md).

## Still to check

- The Washington Post's RSS ToS: it returned 403 to automated fetches, so read it in a browser.
- Bloomberg's feeds page returned 403 and NPR's /rss returned 404; their site terms were read instead.
