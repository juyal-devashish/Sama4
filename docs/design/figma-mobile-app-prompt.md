# samā4 — Mobile App Figma Design Prompt (MVP)

## Product Summary

samā4 is an AI-powered contextual news reader built as a native mobile app. When users read news articles, unfamiliar names, organizations, events, and concepts are automatically highlighted. Tapping a highlight reveals an instant, AI-generated context card — like a smart Wikipedia overlay built into the reading experience.

Think: "Genius annotations for the news."

Target platforms: iOS and Android (design iOS-first at 393×852, iPhone 15 Pro).

---

## Design Philosophy

- **Native mobile, not a wrapped website**: This should feel like it belongs on the home screen next to Apple News and Artifact — native gestures, system-level feel, no browser chrome.
- **Reading-first**: Content is king. The UI disappears when you're reading.
- **Contextual, not disruptive**: Entity highlights feel native to the text. Context cards slide up as bottom sheets, never blocking the full article.
- **Elegant minimalism**: Inspired by the Millennium Management (mlp.com) aesthetic — clean, modern, corporate-yet-warm, with strong typographic hierarchy and generous whitespace.

---

## Typography System (Inspired by mlp.com)

The type system draws from the same Google Fonts stack used on mlp.com: **Poppins** for headings and UI, **Roboto** for body and supporting text. This pairing balances corporate trust with modern readability.

### Primary Font — Poppins (Headings & UI)

A clean, geometric sans-serif with rounded but professional shapes. Conveys trust and dynamism.

| Element | Weight | Size | Letter Spacing | Usage |
|---------|--------|------|----------------|-------|
| App Title / H1 | ExtraBold (800) | 28–32pt | -1% | Hero headlines, screen titles |
| Section Header / H2 | SemiBold (600) | 22–24pt | 0% | Section dividers, card titles |
| Subheading / H3 | Medium (500) | 18–20pt | 0% | Article card titles, entity names |
| Navigation & Tabs | SemiBold (600) | 14–15pt | 0.5% | Tab bar labels, nav items |
| Buttons & CTAs | SemiBold (600) | 15–16pt | 0.5% | Primary/secondary action buttons |

### Secondary Font — Roboto (Body & Content)

A neutral, highly readable sans-serif optimized for long-form mobile reading.

| Element | Weight | Size | Line Height | Usage |
|---------|--------|------|-------------|-------|
| Article Body | Regular (400) | 16–17pt | 1.6 | Main article text |
| Article Summary | Regular (400) | 14–15pt | 1.5 | Card subtitles, previews |
| Captions & Meta | Regular (400) | 12–13pt | 1.4 | Timestamps, source names, badges |
| Small UI Text | Medium (500) | 11–12pt | 1.3 | Tag pills, entity type labels |

### Hierarchy Principles (from mlp.com)

- Use **weight contrast** to establish hierarchy, not just size — a Bold 18pt heading over Regular 16pt body creates clean separation without huge size jumps
- Minimal decorative flourishes — understated and subtle
- Consistent line heights and spacing that improve scan-ability on small screens
- All fonts loaded from Google Fonts CDN for consistency across platforms

---

## Color System (Inspired by mlp.com)

mlp.com uses a refined, professional palette: deep dark backgrounds, clean whites, and carefully restrained accent colors. samā4 adapts this into a mobile-native system with both light and dark modes.

### Light Mode

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Background (Primary) | Off-White | #FAFAFA | Main screen background |
| Background (Secondary) | Warm Gray | #F2F0ED | Card backgrounds, input fields |
| Surface (Elevated) | White | #FFFFFF | Bottom sheets, modals, floating cards |
| Text (Primary) | Near-Black | #1A1A2E | Headlines, article body |
| Text (Secondary) | Dark Gray | #5A5A6E | Subtitles, metadata, captions |
| Text (Tertiary) | Medium Gray | #9090A0 | Placeholders, disabled text |
| Divider / Border | Light Gray | #E5E5EA | Card borders, separators |
| Accent (Primary) | Deep Navy | #0D1B3E | Active tabs, primary buttons, key UI elements |
| Accent (Secondary) | Steel Blue | #3A5A8C | Links, secondary highlights |
| Entity Highlight | Soft Gold | #F5E6C8 | Background tint on highlighted entities |
| Entity Highlight (Active) | Warm Amber | #E8C874 | Entity being tapped / context card open |
| Success | Forest Green | #2D7A4F | Status indicators |
| Error | Warm Red | #C94444 | Error messages, destructive actions |

### Dark Mode

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Background (Primary) | Rich Black | #0A0A14 | Main screen background |
| Background (Secondary) | Dark Navy | #12142A | Card backgrounds, input fields |
| Surface (Elevated) | Charcoal | #1C1E36 | Bottom sheets, modals, floating cards |
| Text (Primary) | Off-White | #EAEAF0 | Headlines, article body |
| Text (Secondary) | Light Gray | #A0A0B4 | Subtitles, metadata |
| Text (Tertiary) | Muted Gray | #606078 | Placeholders, disabled text |
| Divider / Border | Dark Slate | #2A2A40 | Card borders, separators |
| Accent (Primary) | Light Blue | #6B9FD4 | Active tabs, primary buttons |
| Accent (Secondary) | Soft Blue | #4A7AB5 | Links, secondary highlights |
| Entity Highlight | Deep Gold | #3D3220 | Background tint on highlighted entities |
| Entity Highlight (Active) | Amber Glow | #C9A84C | Entity being tapped |
| Success | Soft Green | #4CAF7A | Status indicators |
| Error | Soft Red | #E06060 | Error messages |

### Color Principles

- The palette feels like "investment firm meets modern news reader" — professional, trustworthy, but not cold
- Accent colors are used sparingly — primarily for interactive elements and entity highlights
- Entity highlights use warm gold tones that stand out from the cool navy/gray base without being distracting
- Dark mode is the premium experience (like mlp.com's dark hero sections) — design it with equal care, not as an afterthought

---

## App Structure & Navigation

### Bottom Tab Bar (5 tabs)

| Tab | Icon | Screen |
|-----|------|--------|
| Feed | Newspaper icon | Home feed with article cards |
| Search | Magnifying glass | Semantic search |
| Bookmarks | Bookmark icon | Saved articles (stretch) |
| Trending | Flame / chart icon | Trending entities (stretch) |
| Profile | Person circle | User settings (stretch) |

The tab bar uses Poppins SemiBold 11pt for labels. Active tab uses Accent (Primary) color, inactive tabs use Text (Tertiary).

For MVP, design Feed, Search, and Profile. Bookmarks and Trending can be shown as "Coming Soon" placeholders.

---

## Screens to Design

### 1. Feed / Home Screen

**Tab**: Feed (default landing)

**Layout (top to bottom)**:
- **Status bar** (system)
- **Top bar**: samā4 wordmark (Poppins ExtraBold, 20pt) left-aligned, notification bell icon right-aligned. Clean, no background color — blends with content area.
- **Greeting** (optional): "Good morning, Devashish" in Poppins Medium 16pt, Text (Secondary) color. Adds a personal touch.
- **Category chips**: Horizontal scrollable row of pill-shaped category filters (All, Politics, Technology, Science, Business, Health, World). Active chip is filled with Accent (Primary), white text. Inactive chips are outlined with Border color, Text (Secondary).
- **Article feed**: Vertical scrolling list of article cards with pull-to-refresh.

**Article Card Design**:
- Card background: Background (Secondary) with 12px corner radius, no hard border (use subtle shadow or 1px border)
- Layout: image on top (full card width, 180pt height, 12px top radius) or compact layout (thumbnail 72×72 right-aligned)
- **Top story** (first card): full-width hero image with gradient overlay, title overlaid on image in white Poppins SemiBold 20pt
- **Regular cards**:
  - Title: Poppins Medium 17pt, Text (Primary), max 2 lines
  - Summary: Roboto Regular 14pt, Text (Secondary), max 2 lines
  - Metadata row: Source favicon + "Reuters" · "2h ago" · "4 min read" in Roboto Regular 12pt, Text (Tertiary)
  - Entity badge: small pill "12 key terms" with a subtle sparkle/brain icon, in Roboto Medium 11pt, Accent (Secondary) text on a light tinted background
- Spacing: 12px between cards, 16px horizontal padding

**States**:
- **Loading**: Skeleton placeholders matching card layout — pulsing rectangles in Background (Secondary)
- **Empty**: Centered illustration (simple line art) + "No articles yet.\nCheck back soon." in Poppins Medium 18pt
- **Error**: Centered warning icon + "Failed to load articles." in Poppins Medium 16pt + "Tap to retry" button in Accent (Primary)
- **Pull to refresh**: Custom spinner using Accent (Primary) color

---

### 2. Article Detail Screen

**Transition**: Card tap → shared element transition (card image expands to hero)

**Layout (top to bottom)**:
- **Hero image**: Full-width, 280pt height, with a dark gradient overlay (bottom 50%)
- **Floating top bar** (over hero): Back arrow (left), Share icon + Bookmark icon (right). White icons with subtle drop shadow for visibility over image.
- **Title**: Overlaid on hero gradient — Poppins Bold 24pt, white, max 4 lines
- **Metadata bar** (below hero, on content background): Source logo + name · Author · "Dec 15, 2025" · "4 min read" in Roboto Regular 13pt, Text (Secondary)
- **Category pills**: Row of small rounded pills (e.g., "Technology", "AI") in Roboto Medium 11pt, Accent (Secondary) text on tinted background
- **"View all references" button**: Right-aligned text button in Accent (Primary), Poppins Medium 14pt, with a small arrow icon. This leads to the Reference Page.
- **Article body**: Roboto Regular 16pt, Text (Primary), 1.65 line height. Generous 20px side padding. Optimized for comfortable thumb-zone reading.

**Entity Highlighting** (the core feature):
- Highlighted terms have a subtle background tint (Entity Highlight color) and a thin bottom border (1.5px, Accent Secondary)
- **Three priority levels** (matching the ArticleEntity.priority field):
  - **High**: Warm amber background tint + 2px underline — these are terms most readers won't know
  - **Medium**: Soft gold background tint + 1.5px underline — standard highlights
  - **Low**: Very faint tint, almost invisible + 1px dotted underline — only noticeable if you're looking
- Tapping a highlight: the term briefly scales up (102%, 100ms) and the Context Card bottom sheet slides up

**Sticky bottom bar** (while reading): A thin bar showing reading progress (accent-colored line that fills left-to-right as user scrolls). Below it, a subtle "12 highlighted terms in this article" in Roboto Regular 12pt.

---

### 3. Entity Context Card (Bottom Sheet)

This is the most important UI component in the app. It's the "wow" moment.

**Trigger**: Tap any highlighted entity in the article body.

**Bottom Sheet Design**:
- Slides up from bottom with a spring animation (200ms, slight overshoot)
- Covers ~40-45% of screen height (dismissible by swipe-down or tap on dimmed area above)
- **Drag handle**: 36×4px rounded bar, centered, in Divider color
- **Content layout**:
  - Entity name: Poppins SemiBold 20pt, Text (Primary)
  - Entity type badge: Small pill — "Person" / "Organization" / "Event" / "Concept" / "Location" — each with a unique color:
    - Person: #4A7AB5 (blue)
    - Organization: #7A5AB5 (purple)
    - Event: #B5764A (orange)
    - Concept: #4AB58A (green)
    - Location: #B54A6E (rose)
  - Context paragraph: Roboto Regular 15pt, Text (Primary), 1.55 line height — 2-4 sentences explaining who/what this entity is in the context of the current article
  - Wikipedia link (if available): "Read on Wikipedia →" in Accent (Secondary), Roboto Medium 14pt
  - Divider line
  - "View all references →" link: navigates to the full Reference Page
- **Loading state**: Skeleton lines (3 rows) with a subtle shimmer animation while AI generates context
- **Stretch goal**: "Ask a follow-up" text input at the bottom — allows users to type a question about the entity, answered by AI in real-time

**Interaction details**:
- The highlighted term in the article behind should stay visually active (brighter highlight) while the sheet is open
- The dimmed overlay behind the sheet should be 40% black opacity
- Swipe down to dismiss with velocity-based snapping (fast swipe = dismiss, slow drag = snap back if <30% dragged)

---

### 4. Reference / Deep Dive Page

**Transition**: Push from right (standard iOS navigation)

**Layout**:
- **Header**: "Key References" in Poppins SemiBold 22pt + article title below in Roboto Regular 14pt, Text (Secondary)
- **Entity count**: "24 terms found" in Roboto Regular 13pt, Text (Tertiary)
- **Grouped sections** by entity type:
  - Section header: Entity type name + count — "People (8)" in Poppins Medium 16pt, Text (Secondary)
  - Entity rows within each section:
    - Entity name: Poppins Medium 16pt, Text (Primary)
    - Mention count: "mentioned 3×" in Roboto Regular 12pt, Text (Tertiary)
    - "In title" badge (if applicable): tiny pill in Accent (Primary) background
    - 1-line context preview: Roboto Regular 13pt, Text (Secondary), truncated with "..."
    - Chevron right (for expandable detail)
  - Tapping a row expands it inline to show the full AI-generated context (accordion-style, with smooth height animation)
- **Sticky search/filter bar** at top: allows filtering entities by type or searching by name

---

### 5. Search Screen

**Tab**: Search

**Layout**:
- **Search input**: Large rounded rectangle input field, auto-focused on tab tap. Magnifying glass icon left, clear button right. Poppins Medium 17pt for input text. Background (Secondary) fill.
- **Before search**: "Search across all articles and entities" placeholder text. Below it, optional "Recent searches" section with pill-shaped recent query chips.
- **While typing**: Real-time results appear as article cards (same compact card component as feed, without hero images)
- **Results**: Grouped into "Articles" and "Entities" sections with a segmented control toggle at the top
- **No results**: Centered — "No matches found.\nTry different keywords." in Poppins Medium 16pt + Roboto Regular 14pt
- **Keyboard**: Design should account for keyboard covering bottom ~40% of screen — results scroll above keyboard

---

### 6. Profile / Settings Screen (MVP minimal)

**Tab**: Profile

**Layout**:
- User avatar circle (placeholder) + "Devashish" in Poppins SemiBold 20pt
- Simple list of settings rows:
  - Reading preferences (text size slider)
  - Dark mode toggle
  - Notification preferences
  - About samā4
  - Sign out
- Each row: Roboto Regular 16pt, Text (Primary), with chevron right
- This screen is low-priority for design polish — functional is fine

---

## Onboarding Flow (3 screens)

Design a simple 3-step onboarding carousel shown on first launch:

1. **"Read smarter, not harder"** — Illustration of a phone with highlighted article text. Explains the core concept.
2. **"Tap to understand"** — Illustration showing a finger tapping a highlighted name, with a context card appearing. Explains the highlight interaction.
3. **"Choose your interests"** — Grid of category pills the user can tap to select (Technology, Politics, Science, etc.). This personalizes the feed.

- Each screen: Centered illustration (top 50%), Poppins Bold 24pt title, Roboto Regular 16pt subtitle below
- Dot indicators at bottom + "Next" / "Get Started" button in Accent (Primary)
- Background: clean white (light mode) or Rich Black (dark mode)

---

## Component Library

Design these as reusable Figma components with variants and auto-layout:

| # | Component | Variants |
|---|-----------|----------|
| 1 | ArticleCard | Hero (top story), Standard, Compact (search), Skeleton |
| 2 | CategoryChip | Active, Inactive, Disabled |
| 3 | EntityHighlight | High/Medium/Low priority, Active (tapped) |
| 4 | ContextCard (Bottom Sheet) | Default, Loading (skeleton), With follow-up input |
| 5 | EntityTypeBadge | Person, Organization, Event, Concept, Location (each with unique color) |
| 6 | EntityRow | Collapsed (1-line preview), Expanded (full context) |
| 7 | SearchBar | Collapsed (icon in tab bar), Expanded (full input) |
| 8 | TopBar | Feed (logo + bell), Article (back + share + bookmark), Reference (back + title) |
| 9 | BottomTabBar | 5 tabs, each with active/inactive state |
| 10 | ErrorState | Network error (with retry), Empty feed, No search results |
| 11 | SkeletonLoader | Card skeleton, Article body skeleton, Context card skeleton |
| 12 | ReadingProgressBar | Thin accent-colored bar showing scroll progress |
| 13 | OnboardingPage | Illustration + title + subtitle + dots + button |
| 14 | SettingsRow | Label + chevron, Label + toggle, Label + slider |

---

## Native Mobile Interactions & Animations

| Interaction | Behavior |
|-------------|----------|
| Pull to refresh | Custom spinner with samā4 accent color, rubber-band overscroll |
| Infinite scroll | Small spinner at feed bottom when loading more articles |
| Card → Article | Shared element transition: card image expands to hero image |
| Article → Feed | Swipe from left edge (iOS) or back gesture (Android) |
| Entity tap → Context Card | Bottom sheet slides up with spring animation (200ms, dampingRatio 0.85) |
| Context Card dismiss | Swipe down with velocity-based snap (fast = dismiss, slow = rubber-band) |
| Entity row expand | Smooth height animation (accordion, 250ms ease-out) |
| Tab switching | Crossfade transition (150ms) |
| Highlight on tap | Brief scale-up pulse (102%, 100ms) + background tint brightens |
| Skeleton loading | Shimmer animation sweeping left-to-right across skeleton blocks |
| Reading progress | Thin line at top of article screen that fills smoothly as user scrolls |

---

## Screens Checklist

| # | Screen | Mode | Priority |
|---|--------|------|----------|
| 1 | Feed — populated | Light | P0 |
| 2 | Feed — populated | Dark | P0 |
| 3 | Feed — loading (skeleton) | Light | P0 |
| 4 | Feed — empty state | Light | P1 |
| 5 | Feed — error state | Light | P1 |
| 6 | Article Detail — with highlights | Light | P0 |
| 7 | Article Detail — with highlights | Dark | P0 |
| 8 | Article Detail + Context Card open | Light | P0 |
| 9 | Article Detail + Context Card open | Dark | P0 |
| 10 | Context Card — loading state | Light | P1 |
| 11 | Reference Page — expanded entity | Light | P1 |
| 12 | Reference Page — expanded entity | Dark | P1 |
| 13 | Search — empty | Light | P1 |
| 14 | Search — with results | Light | P1 |
| 15 | Onboarding — all 3 screens | Light | P1 |
| 16 | Profile / Settings | Light | P2 |

---

## What Makes samā4 Visually Unique

The core differentiator is the **entity highlighting + context card** interaction. The design should make this feel magical — like the article is alive with knowledge. When a user taps a highlighted name and gets an instant, perfectly contextual explanation, that's the "wow" moment.

The visual identity — Poppins + Roboto type pairing on a refined navy-and-gold palette — positions samā4 as a serious, trustworthy intelligence tool (not a casual news aggregator). It should feel like the intersection of Bloomberg Terminal polish and Instapaper reading comfort. The mlp.com DNA is in the restraint: generous whitespace, weight-based hierarchy, and an accent palette that whispers rather than shouts.
