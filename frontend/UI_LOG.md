# UI_LOG — autonomous UI/UX loop

**Started:** Thu Nov 12 11:15 EST 2026 (no new work after ~12:00, hard stop ~12:15)

## Backlog (ranked by reader impact)

1. Screenshot baselines (visual regression) for every route at 1440/375, light/dark. Needs deterministic seeded data in CI first (CI has no backend).
2. Lighthouse: LCP ~3.3 s on every route (lab, throttled). Home LCP is the welcome dialog fade-in; try rendering its text immediately. `/` is 173 kB first load — look at what the reader pulls in (framer-motion?).
3. Keyboard flow tests: J/K/S/Esc and `/` end to end (Esc is covered by the term test).
4. Settings and Outlook: tertiary copy is now AA, but check Outlook readability and empty/error states at 375px.
5. Onboarding dialog: check focus return after dismiss.

## Done

### PR #13 — axe e2e suite + AA contrast (ui/e2e-a11y-baseline)

- Playwright + `@axe-core/playwright` (dev deps) in `frontend/e2e/`, `frontend-e2e` CI job.
  Scans 6 routes × light/dark × 1440/375px, plus: welcome dialog, open context panel,
  reference page, loading skeletons, reduced-motion.
- **`--text-tertiary` failed AA on nearly every route** (3.2–4.0:1): light `#8a8a9a`→`#6b6b7d`,
  dark `#6e6e88`→`#8e8eaa`. Still visibly below `--text-secondary`.
- Announcements dark demo date used a 30% alpha colour → `--text-muted`.
- Announcements page now honours `prefers-reduced-motion` (test fails without the rule).
- Skeletons put `aria-label` on a bare div (prohibited ARIA); now `role="status"`.
  Found by CI, not locally: the feed was still pending there.

### PR #14 — heading order + best-practice axe rules (merged)

- Story titles `h3`→`h2` under the page `h1`; announcements phone-mock headline `h3`→`h2`.
- axe scans include `best-practice` (catches heading-order). Only visible with real data, so
  verified against a production build with seeded articles: 34/34.

### PR #15 — phone toolbar (merged)

- At 375px the reading-pane toolbar ran off-screen: **Save was at x=471** with no horizontal
  scroll, so phone readers could not save a story. Icon-only below `sm`, names kept
  (label-in-name), tighter padding. Overflow sweep of all 8 routes at 375px: nothing else overflows.

### PR #16 — API fixtures for e2e (merged)

- Specs now run against recorded responses (`e2e/fixtures/api.json`, refresh with
  `node e2e/capture-fixtures.mjs`), so term/reference/toolbar flows and the route scans run in CI
  on real content with no backend. Verified with the backend stopped: 36/36.

### PR #17 — Settings theme switch at phone width (merged)

- "Match system" wrapped and the switch ended at x=384 on a 375px screen. Icons hidden and label
  shortened below `sm`; layout test fails without the fix.

### PR #18 — keyboard shortcut e2e (J/K, S, /) (merged)

### PR #19 — calmer desktop chrome (round 2: desktop focus, at Devashish's request)

- Audit at 1440/1920, light/dark, idle and with a term open. The reading-pane bar drew a rule
  across the middle of the three panes (list and margin have none) and repeated the source name
  shown under the headline. Rule + source name now appear only after the story scrolls.
- Selected story: ring and shadow removed; surface fill + accent bar only.

## Decisions

- Route scans set `sama4_onboarded` so the first-run dialog doesn't overlay them; it has its own scan.
- Flow tests skip when the seeded article is absent (CI has no backend).
- The backend CORS allowlist is `localhost:3000` only, so run prod builds on :3000 (not 3100) when testing with the local API.
- Don't run `npm run build` while `next dev` is up — they share `.next` and the dev server breaks.

## Metrics

| Metric                    | Before        | After |
| ------------------------- | ------------- | ----- |
| axe: desktop route scans  | 12/12 failing | pass  |
| axe checks total (local)  | —             | 35/35 |
| axe (best-practice) local | —             | 34/34 |

Lighthouse (prod build, mobile emulation, seeded local API, 2026-11-12 before PR #14):

| Route          | Perf | A11y | LCP   | CLS | TBT  |
| -------------- | ---- | ---- | ----- | --- | ---- |
| /              | 91   | 100  | 3.4 s | 0   | 0 ms |
| /announcements | 90   | 98   | 3.7 s | 0   | 0 ms |
| /outlook       | 93   | 100  | 3.2 s | 0   | 0 ms |
| /search        | 92   | 100  | 3.3 s | 0   | 0 ms |
| /saved         | 92   | 100  | 3.3 s | 0   | 0 ms |
| /settings      | 92   | 100  | 3.4 s | 0   | 0 ms |

First Load JS: / 173 kB, shared 84.3 kB, others 95–115 kB.
Home LCP element is the first-run welcome dialog paragraph (element render delay ~750 ms:
the dialog fades in). TTFB is ~5 ms. Idea: don't fade the dialog's text from opacity 0.

## Round 3: UI/UX fix checklist (12 Nov, afternoon)

Worked through Devashish's checklist one item at a time, one PR each.

**P1, sources and AI material**

- #21 "Read the original at <publisher>" link on every story.
- #23 Labels: "In brief" is an AI summary; the body is "From <publisher>"; explanations say they are AI-written.
- #22 (backend) Possessives folded ("Jensen Huang's" → Jensen Huang); Claude types every spaCy name (Nvidia → ORG).
  `POST /admin/entities/canonicalize` (dry run by default) cleans stored data.
- #24 (backend) Follow-ups grounded in the article text and the explanation shown; answers tag sources, shown as links.
- #27 Missing explanations say so and offer a next step.
- #25 (backend field) Outlook labelled as an AI projection; Confidence/Impact explained; "500 simulated" was false for the
  LLM fallback → `method` field, "Viewpoints written: 5"; reaction = estimate; personas tagged "AI persona".
- #26 (backend) Outlook progress steps (skipped steps never shown as done), Cancel, no double starts.

**P2**

- #28 Announcements → Early access (/announcements redirects), one navigation, click/keyboard copy, "Samā4" spelling.
- #30 Waitlist: real label, inline accessible errors, data-use note, /privacy page. Found and fixed a production bug:
  waitlist error/success messages never appeared (re-render replaced the static markup's nodes).
- #29 Search filters (topic, source, date) + "newest first".
- #31 Topic/chip/feed/open-story sync; hidden and unknown topic links; chips are toggle buttons; regression test.
- #32 Saved: undo after removal; remove button visible on touch.
- #33 Terms list reachable on phones/tablets (toolbar Terms button); live regions for answers and outlook completion.
- #35 Offline state that recovers by itself; reader-facing error copy.

**P3**

- #34 Demo labelled as a sample; stats show final values (no zero); benefits-first cards (Claude, not Mistral); one CTA.

**Backend PRs need `make deploy-backend`** (auto-deploy skips without RAILWAY_TOKEN): #22, #24, #25, #26.
After deploying #22, run the entity cleanup as a dry run first and read the report.

**Still open (needs Devashish)**

- Terms of service, and a contact for data requests (waitlist removal) on /privacy.
- Marketing claims the app doesn't back: browser extension/Chrome, Substack/newsletters, voice briefings,
  multi-language, depth control; stats (50K+ articles, 99.7% uptime, <200ms) need a source and period or removal.
- `next/font` fetches Google Fonts at build time and flaked several times today (CI and Vercel); self-hosting the
  fonts would remove the flake.
- Ultra-wide (2560px): line length is good; the reading toolbar's actions sit far from the text column.

## Final summary (round 1, 11:15 to about 11:50 EST)

Shipped: #13–#17 merged (#18 open): AA contrast token fix, axe suite in CI (6 routes x 2 themes x
2 viewports + dialog/panel/reference/skeleton/reduced-motion), heading order, reduced motion,
role=status skeletons, phone toolbar, Settings theme switch, fixture-backed e2e, keyboard tests.
Metrics: axe 12/12 desktop route scans failing -> 41 e2e checks passing (3 phone skips by design).
Lighthouse perf 90-93, a11y 98-100 before; announcements a11y should now be 100 (not re-measured).
Production verified after #13: new tokens live, console clean.
Top backlog next time: re-run Lighthouse after these PRs; screenshot baselines (needs Linux
baselines generated in CI); mobile bottom nav proposal; Outlook with real prediction data
(fixtures have none); focus handling inside the mobile drawer.

## Desktop backlog (round 2 audit, not yet done)

1. Context margin: the follow-up box is pinned to the bottom, ~700px below the explanation at
   1080px tall. Consider placing it directly under the explanation until a conversation starts.
2. Pane top alignment: "Today" (y≈41), the reading bar (centre y≈29) and the margin heading
   (y≈34) sit on three different lines. Put all three on one 56px header band.
3. Topic chips wrap to two rows in the 340px list (6 chips ≈ 465px). One scrollable row, or move
   topic filtering into the "Today" header as a menu.
4. Headline weight: 44px Poppins 800 is heavy next to 18px Roboto body; 700 may read calmer.
   (Typography change — your call.)

## Proposals (need your call — not done)

- **Mobile nav:** below 640px the 72px icon sidebar eats ~20% of the screen. A bottom tab bar
  would give the story ~300→375px of width. That is a layout-model change, so not done.
- **Page title alignment:** page widths are 880/960/1080 px by design, so the title's left edge
  jumps between sidebar items (316 vs 356 px at 1440). Consider one reading column.
- **Duplicate source name** in the reading-pane toolbar and the meta row under the title.
- **Welcome dialog is the home LCP element** for first-run visitors (mounted after hydration, then
  fades in). Returning readers don't see it, so low priority.

## Open questions for Devashish

- Auto-fix CI monitor was refused by the permission classifier; I'm checking CI by hand. Fine?
- Your old local `.gitignore`/`launch.json` edits are in `git stash` ("pre-ui-loop local changes"); both are already in main via #12.
