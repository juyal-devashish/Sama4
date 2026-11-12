# samā4 — Figma Design Prompt (MVP)

## Product Summary

samā4 is an AI-powered contextual news reader. When users read news articles, unfamiliar names, organizations, events, and concepts are automatically highlighted. Tapping a highlight reveals an instant, AI-generated context card — like a smart Wikipedia overlay built into the reading experience.

Think: "Genius annotations for the news."

---

## Design Philosophy

- **Clean, reading-first**: The UI should feel like a premium news app (inspiration: Apple News, Matter, Artifact). Content is king — chrome should disappear.
- **Contextual, not disruptive**: Entity highlights should feel native to the text, not like a cluttered hyperlink farm. Context cards should appear inline or as smooth bottom sheets, never blocking the article.
- **Dark mode ready**: Design in both light and dark themes from the start.
- **Mobile-first, desktop-responsive**: Primary experience is phone-sized (390×844), but it should scale gracefully to tablet and desktop.

---

## Color & Typography Guidelines

- **Palette**: Neutral base (off-white / near-black for dark mode), with a single accent color for highlights and interactive elements. Suggested accent: a warm amber/gold (#E5A23C) or a cool teal (#2ABFBF) — something that reads as "intelligent" without feeling corporate.
- **Entity highlight color**: Subtle underline or soft background tint on highlighted terms — NOT bold colored text. It should invite a tap without screaming.
- **Typography**: A modern serif for article body text (e.g., Newsreader, Source Serif, Charter) paired with a clean sans-serif for UI elements (e.g., Inter, SF Pro). This signals "journalism meets tech."

---

## Screens to Design

### 1. Feed / Home Screen

**Route**: `/`

**Layout**:
- Top bar with samā4 logo/wordmark and a search icon
- Horizontal scrollable category tabs (All, Politics, Technology, Science, Business, Health, World, etc.) — the active tab is visually distinct
- Vertical scrolling list of article cards

**Article Card** contains:
- Thumbnail image (right-aligned, ~80×80 or full-width hero for the top story)
- Article title (2 lines max, bold)
- 1-line summary/subtitle (muted text)
- Source name + relative time ("Reuters · 2h ago")
- Reading time ("4 min read")
- Entity count badge ("12 key terms" or a small pill with an icon) — this is a differentiator, make it visible but tasteful

**States to show**:
- Loading: skeleton placeholders (pulsing gray blocks matching card layout)
- Empty: friendly illustration + "No articles yet. Check back soon."
- Error: "Failed to load articles. Please try again." with a retry button

---

### 2. Article Detail Screen

**Route**: `/article/[id]`

**Layout**:
- Back arrow top-left, share icon top-right, "View all references" button
- Hero image (full-width, with gradient overlay for title)
- Title (large, serif)
- Metadata row: Source name · Author · Date · Reading time
- Category pills/tags
- Article body text — this is where the magic happens:

**Entity Highlighting**:
- Certain words/phrases in the body are subtly highlighted (e.g., soft underline + faint background tint)
- Highlighted entities have 3 priority levels:
  - **High priority**: slightly bolder highlight (e.g., thicker underline or warmer tint) — these are the terms most readers won't know
  - **Medium priority**: standard subtle highlight
  - **Low priority**: very faint, almost invisible unless you look for it
- Tapping a highlighted entity opens a **Context Card** (see below)

**Context Card** (inline or bottom sheet):
- Entity name as header
- Entity type pill (Person, Organization, Event, Concept, Location)
- Short AI-generated context paragraph (2-4 sentences explaining who/what this is in the context of the article)
- "Learn more" link that navigates to the reference page
- Dismiss via swipe-down or tap outside

---

### 3. Reference / Deep Dive Page

**Route**: `/article/[id]/reference`

**Purpose**: A single page listing ALL entities mentioned in an article, organized for deeper exploration.

**Layout**:
- Header: "Key References" + article title
- Grouped by entity type (People, Organizations, Events, etc.)
- Each entity row shows:
  - Entity name
  - Type badge
  - Mention count ("mentioned 3×")
  - Whether it appeared in the title (small "in title" badge)
  - Short context snippet (1 line)
- Tapping an entity expands it to show the full AI-generated context (or navigates to a dedicated entity page)

---

### 4. Search Screen

**Route**: `/search`

**Layout**:
- Large search input field (autofocused)
- As user types, results appear below
- Results are article cards (same component as feed) filtered by semantic search
- Empty state: "Search across all articles and entities"
- No results state: "No matches found. Try different keywords."

---

### 5. Entity Context Modal (Component)

This is the most important UI innovation. Design it as a reusable component:

**Variant A — Bottom Sheet** (mobile):
- Slides up from bottom, covering ~40% of screen
- Drag handle at top
- Entity name, type badge, context paragraph
- "Ask a follow-up" input field at bottom (stretch goal — allows users to ask a clarifying question about the entity, answered by AI)

**Variant B — Inline Popover** (desktop):
- Appears directly below the highlighted term
- Arrow pointing to the term
- Same content as bottom sheet but in a floating card
- Click outside to dismiss

---

## Component Library to Build

Design these as reusable Figma components with variants:

1. **ArticleCard** — variants: default, loading/skeleton, compact (for search results)
2. **CategoryTab** — variants: active, inactive
3. **EntityHighlight** — variants: high/medium/low priority, tapped (active)
4. **ContextCard** — variants: bottom sheet (mobile), popover (desktop), loading
5. **EntityBadge** — variants by type: Person, Organization, Event, Concept, Location
6. **SearchBar** — variants: collapsed (icon only), expanded
7. **NavigationBar** — top bar with logo, search, optional back button
8. **ErrorState** — reusable error message with retry button
9. **EmptyState** — reusable empty state with illustration
10. **SkeletonLoader** — for cards and article body

---

## Interaction Notes

- **Pull to refresh** on the feed
- **Infinite scroll** for loading more articles (show a small spinner at the bottom)
- **Smooth transitions**: article card tap → article detail should feel like a fluid expansion, not a hard page change
- **Highlight interaction**: tapping a highlighted entity should feel immediate — the context card should appear with a quick spring animation (150-200ms)
- **Swipe back** from article detail to feed

---

## Screens Summary (Design These)

| # | Screen | Priority |
|---|--------|----------|
| 1 | Feed (populated) | P0 |
| 2 | Feed (loading/skeleton) | P0 |
| 3 | Feed (empty state) | P1 |
| 4 | Feed (error state) | P1 |
| 5 | Article Detail (with highlights) | P0 |
| 6 | Article Detail + Context Card open | P0 |
| 7 | Reference Page | P1 |
| 8 | Search (empty) | P1 |
| 9 | Search (with results) | P1 |
| 10 | Dark mode variants of screens 1, 5, 6 | P1 |

---

## What Makes samā4 Visually Unique

The key differentiator is the **entity highlighting + context cards**. The design should make this feel magical — like the article is alive with knowledge. When a user taps a highlighted name and gets an instant, perfectly relevant explanation, that's the "wow" moment. Everything else (feed, search, navigation) should be familiar and invisible so that this core interaction shines.
