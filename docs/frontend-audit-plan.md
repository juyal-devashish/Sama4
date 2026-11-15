# Frontend audit: triage and plan

The audit from Sat Nov 14, 2026 (about 21:00 ET) read server HTML only, with no browser. I checked each finding against `main` (cb1ad16) and the live site. Some findings no longer apply, and some were misread. So this plan works from that triage, not from the audit's 100 tasks as written.

## What the check changed

1. **The wrong date (FB-1) is real, but the audit's fix (T003) would keep the bug.** The Masthead and the Today `<h1>` format `new Date()` while the server renders. `/` is `force-dynamic` on Vercel, so it renders in UTC: at 21:00 ET it is already Sunday. /about, /search and /sources are prerendered (`x-vercel-cache: PRERENDER`), so the date from build time is baked into them. `suppressHydrationWarning` keeps the server's text, and the client never corrects it. A "server value as fallback" keeps exactly this behaviour. The fix is to render the date only on the client after mount, in a box with reserved width. `PublishedTime` ("18h ago") has the same problem (T057).
2. **The cut-off summaries (CQ-1) are a backend bug.** The card already clamps with CSS (`line-clamp-2`). The API returns `"Existing U.S."` because `cap_words()` in `backend/app/ingestion/summarizer.py` treats the full stop in `Gov.` and `U.S.` as the end of a sentence (`_SENTENCE_END`). The fix belongs in the backend, with tests, followed by `POST /admin/summaries/regenerate`.
3. **There is no global footer.** Live /, /about and /privacy contain no `<footer>`. The auditor read the first-visit Splash ("Samā4 / News, understood.") as a footer. T007 therefore means designing a place for the trust links. The shell is `h-screen overflow-hidden`, and the reader pane does not scroll as a page.
4. **The /privacy findings (FB-3, T005, T006) are stale.** Live /privacy uses the shared `Page`, spells the brand "Samā4" and has a canonical link. The fetcher got an old build.
5. **About 25 tasks are already done** by product-review items 1–42 (PRs #53, #54) and the axe e2e suite: `referrerPolicy`, lazy loading, `aria-pressed` on the chips, the topic in the URL, the system theme, the AI projection label, the follow-up live region, Read original naming the outlet, and others. The table below marks them **Done**. Each batch opens by checking these again.

Verdicts: **Real** (seen in the code), **Verify** (likely real, but the component wasn't checked closely; check first and close as a no-op if it already holds), **Done**, **Misread**, **Decide** (needs your call before work starts).

## Decisions needed before the batches that use them

All eight were decided on Nov 14, 2026.

| # | Question | Tasks | Decision |
|---|---|---|---|
| D1 | Where do About, Sources, How explanations work and Privacy go, since there is no footer? | T007, T008 | **Rail + page footer.** A small link group at the bottom of the Sidebar rail on desktop, and a footer inside `Page` (info and utility pages). Phones get the `Page` footer plus an "About" item in the Masthead nav. |
| D2 | Which tagline? | T038 | **"News, explained inline"** everywhere. The Splash and IntroFlow change. |
| D3 | Remove Outlook from the primary nav? Rename "Early access"? | T015, T072 | **Outlook stays in the nav with a "Beta" tag.** "Early access" keeps its name, so T072 is a no-op. |
| D4 | Drop the newspaper masthead (tagline and date) on utility and info pages? | T037 | **Slim it off-reader.** The nameplate stays everywhere; the tagline and date columns show only on Today and story pages. |
| D5 | Serve thumbnails through `next/image`? | T051, T028 | **Not yet.** Keep loading images from publishers directly and disclose it on /privacy (T028). T051 is deferred. |
| D6 | Add API fields for the edition's build time and the total story count? | T058, T060 | **Not needed.** Approved, then found redundant: the feed already returns `pagination.total`, and every card has `added_at`, so the edition time is the newest `added_at`. Both are frontend-only. |
| D7 | Replace the PNG owl? | T048 | **Inline SVG** that follows the text color. **Blocked on vector artwork of the owl from you**; batch 2 leaves T048 for last. |
| D8 | Run `summaries/regenerate` in production after the backend fix? | T001 | **No. Only new stories** get correct summaries. The broken summaries already stored stay until they age out of the feed, and the frontend guard (T002) hides the shortest fragments meanwhile. |

## Batches

Each batch is one branch and one PR off `origin/main`. Each task is its own commit (`fix(scope): …`), merged with a merge commit so any task can be reverted. `make check` stays green, and CI (including `frontend-e2e`) is checked before merge. The order is by reader impact, with the test harness first so later batches can prove their fixes.

| Batch | Branch | Tasks | Notes |
|---|---|---|---|
| **0. Evidence harness** (PR #86) | `test/visual-matrix` | T052, T053, T054, T056 (T055 is mostly done) | Playwright screenshots against the recorded fixtures (`e2e/fixtures/api.json`). A fixed clock (`page.clock`) at 21:00 America/New_York also gives a regression test for the date bug. Screenshots go to CI artifacts, without pixel diffs at first. |
| **1. Backend** | `fix/summary-abbreviations` | T001, T002, T041, T043, API half of T058 and T060 | Make `_SENTENCE_END` skip known abbreviations and initialisms (`U.S.`, `Gov.`, `Sen.`, `Dr.`, `St.`, `Jr.`, single capitals). Test with the two live examples. Frontend guard: hide a summary under 40 characters. Fix the display names and feed labels in `ingestion/sources.py`. Deploy with `make deploy-backend`. No regenerate (D8). (The `generated_at`/`total` fields were dropped: see D6.) Status: PR #85. |
| **2. Shell and dates** | `fix/shell-dates` | T003, T004, T057, T010, T022, T036, T068, T071, T007, T037, T038, T015 (Beta tag), T025, T048 last (needs artwork) | One `ClientDate` component (empty on the server, filled after mount, `min-width` reserved) used by the Masthead and the Today h1; `PublishedTime` recomputes on mount. Skip link in `AppShell`. The phone theme button's visible text matches its name. |
| **3. Today feed and story** | `fix/feed-cards` | T009, T016, T021, T026, T030, T059, T061, T062, T065, T096, T058, T060 (UI) | `StoryRow` becomes a `<Link href={storyPath(id)}>` and keeps the in-place selection (Reader already routes by URL). The date `h1` in `StoryList` becomes a `p` or an `h2` on `/article/[id]`. AI-summary label under the Today heading. A clipboard fallback for Copy link. |
| **4. Early-access page** | `fix/landing` | T008, T012, T023, T024, T032, T034, T035, T039, T045, T047, T073, T076, T077 | Everything lives in `landingMarkup.ts`, `landing.css` and `Landing.tsx`. T023 undoes PR #14's h2 choice for the demo headline, so make it a `p` and keep the heading order valid. T031 is a no-op (Search has filters for topic, source and date), but the Search description copy is fixed in batch 6. |
| **5. Info pages and trust copy** | `fix/info-pages` | T013, T028, T040, T042, T044, T046, T078, + per-page `og:` tags | One `InfoPageFooter` component for the closing links on About, Sources, How explanations work and Privacy. Sources links each outlet's site and adds a secondary "RSS" link. 404 links to Today and Search. |
| **6. Search** | `feat/search-url` | T017, T020, T031 (copy), T074 | `q` and filters in the query string through `useSearchParams` wrapped in `Suspense`, so the input still server-renders. Check the empty-results state. |
| **7. Context panel** | `fix/context-panel` | T018, T082, T083, T086, T087, T091, T093, T094 | Focus moves into the panel on open and returns to the term on close. Trap focus only where the panel is an overlay (phones). Show the matched Wikipedia title (data is already in `entity.wikipedia_url`; the title may need an API field: check). Terms are `role="button"` spans: check Enter and Space. |
| **8. Outlook** | `fix/outlook-states` | T019, T049, T079, T081 | Server-render the skeleton and the empty-state sentence. Show impact and confidence as bands, with the number in a details row. |
| **9. Saved, settings, retention** | `feat/device-data` | T050, T090, T095, T098, T099 | "New since last visit" marker (logic in `lib/`, tested). Clear device data in Settings. Saved: a "on this device only" note, plus JSON export and import. |

No-ops to close with a one-line note in the PR that covers their area: T005, T006, T011, T014, T027, T029, T033, T063, T064, T066, T067, T069, T070, T075, T080, T084, T088, T089, T092, T097, T100, T072.

## All 100 tasks

| Task | Verdict | Batch | Note |
|---|---|---|---|
| T001 Clamp summaries | Real (backend) | 1 | CSS clamp already exists; fix `cap_words`; no regenerate (D8) |
| T002 Hide fragment summaries | Real | 1 | Frontend guard only |
| T003 Masthead date in reader's timezone | Real, different fix | 2 | Client-only date; no server fallback |
| T004 Today heading date | Real | 2 | Same `ClientDate` |
| T005 /privacy on shared layout | Done | — | Live page uses `Page` |
| T006 Brand on /privacy | Done | — | |
| T007 Trust links in footer | Misread → Real | 2 | No footer exists; D1: rail + `Page` footer |
| T008 Remove second footer | Misread | 4 | Only the landing footer exists; drop its bare-domain link |
| T009 Cards as anchors | Real | 3 | `StoryRow` is a `<button>` |
| T010 Skip link | Done | — | a11y.spec.ts: "the first Tab stop skips the navigation and lands in the content" |
| T011 Name the logo link | Done | — | `aria-label="Samā4, go to Today"` |
| T012 Waitlist success after success | Verify | 4 | Node is in the HTML with `role="status"` |
| T013 Error-report section on /privacy | Verify | 5 | The description mentions "reports you send" |
| T014 Waitlist wording | Done | — | Privacy says "when sign-in opens" |
| T015 Outlook out of nav | Decided: Beta tag | 2 | D3: stays in nav, tagged "Beta" |
| T016 One h1 on the reader | Real | 3 | StoryList h1 + ReadingPane h1 |
| T017 Search query in URL | Real | 6 | `useState` only |
| T018 Panel focus | Done | — | flows.spec.ts: panel takes focus, traps Tab as a drawer, returns focus |
| T019 Outlook states | Verify | 8 | |
| T020 Server-render search form | Verify | 6 | |
| T021 Label AI summaries | Real (Today) | 3 | Story page already labelled |
| T022 Theme control name | Real | 2 | Visible "Theme" vs name "Switch to dark theme" |
| T023 Demote demo headline | Real | 4 | |
| T024 Section headings | Real | 4 | |
| T025 Title attributes | Decide (keep) | 2 | Tooltip on the icon-only rail; drop only at `xwide`, where the label shows |
| T026 Publisher/time separator | Real | 3 | `<time>` exists; add separator and spoken label |
| T027 No-referrer images | Done | — | |
| T028 Disclose image requests | Real | 5 | |
| T029 Reserve thumbnail space | Done | — | Fixed box with `object-cover` |
| T030 Lazy-load | Done; add priority | 3 | `fetchpriority` on the first image |
| T031 Search claim | Misread | 6 | Filters exist; align Search's description |
| T032 Follow-up claim | Real | 4 | |
| T033 Letter placeholder | Done | — | `aria-hidden` |
| T034 Demo resting state | Real | 4 | |
| T035 Hide phone chrome | Real | 4 | |
| T036 Duplicate date/eyebrow | Real | 2 | |
| T037 Slim header on utility pages | Real | 2 | D4: nameplate only off-reader |
| T038 One tagline | Real, elsewhere | 2 | D2: "News, explained inline"; change Splash/IntroFlow |
| T039 Sentence case | Real | 4 | |
| T040 One date format | Verify | 5 | |
| T041 Full publisher names | Real (backend) | 1 | Names come from `sources.py` |
| T042 Same closing links | Real | 5 | |
| T043 Distinct feed labels | Real (backend) | 1 | |
| T044 Link outlets, not XML | Real | 5 | |
| T045 Merge duplicate cards | Real | 4 | |
| T046 Contact section | Real | 5 | |
| T047 SVG feature icons | Real | 4 | lucide icons already a dependency |
| T048 SVG logo | Real, blocked | 2 | D7: needs owl vector artwork |
| T049 Words before numbers | Verify | 8 | e2e says the figures are explained |
| T050 New since last visit | New | 9 | |
| T051 Resized thumbnails | Deferred | — | D5 |
| T052 Screenshot matrix | New | 0 | |
| T053 Story/panel screenshots | New | 0 | |
| T054 Keyboard walkthrough | New | 0 | |
| T055 axe dark + 375 | Mostly done | 0 | Suite covers 6 routes × themes × 1440/375; add open panel at 375 dark |
| T056 Layout-shift budget | New | 0 | |
| T057 Relative times on client | Real | 2 | `suppressHydrationWarning` keeps server value |
| T058 Edition build time | Real (UI only) | 3 | D6 revised: no API change; newest card `added_at` is the edition time |
| T059 "Earlier" divider | Real | 3 | |
| T060 Count for Load more | Real (UI only) | 3 | D6 revised: `pagination.total` already exists |
| T061 Focus after Load more | Real | 3 | |
| T062 Server-render chips | Verify | 3 | |
| T063 Chip state | Done | — | `aria-pressed` |
| T064 Topic in URL | Done | — | e2e covers it |
| T065 Hide empty reader pane | Verify | 3 | |
| T066 Mark selected card | Done | — | `aria-current` + bar |
| T067 Current nav item | Done | — | |
| T068 Hidden nav out of tab order | Done; label | 2 | `md:hidden` is `display:none`; give the two navs distinct labels |
| T069 Menu button | No-op | — | Phones have no menu button; the nav wraps |
| T070 "/" shortcut | No-op | — | Shortcuts were removed on purpose (#47) |
| T071 One set of landmarks | Verify | 2 | |
| T072 Rename Early access | No-op | — | D3: keep "Early access" |
| T073 Top back-link | Verify | 4 | |
| T074 Empty search results | Verify | 6 | |
| T075 Announce result count | Done | — | `aria-live` on the count |
| T076 Email field attributes | Verify | 4 | e2e covers the label |
| T077 Waitlist pending/error | Verify | 4 | e2e covers inline errors |
| T078 Useful 404 | Real (partial) | 5 | Add a Search link |
| T079 Outlook definitions | Real | 8 | |
| T080 AI projection badge | Done | — | e2e |
| T081 Disclose before outlook | Verify | 8 | |
| T082 Disclose at follow-up | Verify | 7 | |
| T083 Terms are buttons | Verify | 7 | `role="button"` span with `aria-pressed` |
| T084 Not colour alone | Done | — | Bottom border on every term |
| T085 Intro dismissible | Done; verify focus | 7 | Esc skips the intro (e2e) |
| T086 Panel loading/error | Mostly done | 7 | Retry exists (e2e) |
| T087 Matched Wikipedia article | Real | 7 | May need an API field |
| T088 Fallback badge | Done | — | "Wikipedia's own text, and says so" |
| T089 "Version used" link | Done | — | sr-only text names it |
| T090 Clear device data | New | 9 | |
| T091 Report confirmation | Verify | 7 | `ReportError` has a status line |
| T092 Follow-up live region | Done | — | e2e |
| T093 Source label legend | Verify | 7 | |
| T094 Bottom sheet on mobile | Verify | 7 | |
| T095 Save state and undo | Partial | 9 | `aria-pressed` and label done; add undo toast |
| T096 Copy link | Partial | 3 | Status done; add fallback |
| T097 Read original names publisher | Done | — | |
| T098 Saved device note | Partial | 9 | Empty state exists |
| T099 Export/import saved | New | 9 | |
| T100 System theme | Done | — | "Match system" + pre-paint script |

## Not covered by this plan

- Checks the audit couldn't run (contrast, focus styles, touch targets, performance) come from batch 0's screenshots plus the existing axe suite. New findings go into a follow-up list rather than into these batches.
- The open question in `docs/feed-terms.md` (sending outlet text to Claude) is unchanged. Batch 1 only fixes how summaries are cut, not whether they are written.
