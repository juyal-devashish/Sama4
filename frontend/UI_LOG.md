# UI_LOG — autonomous UI/UX loop

**Started:** Thu Nov 12 11:15 EST 2026 (no new work after ~12:00, hard stop ~12:15)

## Backlog (ranked by reader impact)

1. Screenshot baselines (visual regression) for every route at 1440/375, light/dark. Needs deterministic seeded data in CI first (CI has no backend).
2. Lighthouse (LCP/CLS/INP, bundle size) baseline on every route — nothing recorded yet.
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

## Decisions

- Route scans set `sama4_onboarded` so the first-run dialog doesn't overlay them; it has its own scan.
- Flow tests skip when the seeded article is absent (CI has no backend).
- Don't run `npm run build` while `next dev` is up — they share `.next` and the dev server breaks.

## Metrics

| Metric                   | Before        | After |
| ------------------------ | ------------- | ----- |
| axe: desktop route scans | 12/12 failing | pass  |
| axe checks total (local) | —             | 35/35 |
| Lighthouse               | not yet       | —     |

## Open questions for Devashish

- Auto-fix CI monitor was refused by the permission classifier; I'm checking CI by hand. Fine?
- Your old local `.gitignore`/`launch.json` edits are in `git stash` ("pre-ui-loop local changes"); both are already in main via #12.
