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

### PR #18 — keyboard shortcut e2e (J/K, S, /) (this PR)

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
