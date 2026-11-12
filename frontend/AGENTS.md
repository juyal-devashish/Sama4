# frontend/AGENTS.md

Next.js 14 (App Router), React 18, TypeScript (strict), TanStack Query v5 and Tailwind. It's a desktop-first reader deployed on Vercel. Read the root [`AGENTS.md`](../AGENTS.md) first.

## Layout

```
src/
  app/                 routes: / (reader), /article/[id], /article/[id]/reference,
                       /search, /saved, /outlook (predictions), /announcements
                       (product intro + waitlist), /settings
  components/
    shell/             AppShell, Sidebar, Page, WelcomeDialog
    reader/            Reader (3 panes) = StoryList | ReadingPane | context/ContextPanel
                       ArticleText renders highlighted entities
    context/           ContextPanel: explanation + follow-up questions for a selected term
    outlook/           prediction views
    ui/                small shared pieces (states, entity-badge)
  hooks/               one hook per server resource (useFeed, useArticle, useEntityContext …)
  lib/
    api.ts             the ONLY place that calls fetch; throws ApiError(status)
    queryKeys.ts       every React Query key
    highlight.ts       pure entity-highlighting logic (tested)
    preferences.ts     localStorage-backed user prefs (theme, topics, saved stories)
    utils.ts           formatting + entity type → color/label
  types/index.ts       API types; mirrors backend/app/schemas
  styles/globals.css   design tokens (CSS variables), light and dark
```

## Rules

- **Data flow:** component → hook in `hooks/` → `api` in `lib/api.ts`. Components never call `fetch` or `api.*` directly, and never write inline query keys; use `queryKeys`.
- **Pure logic goes in `lib/`** with a `*.test.ts` next to it. Keep React components thin.
- **API types** in `types/index.ts` must match the backend's Pydantic schemas. Change both together.
- **Styling:** use Tailwind and the CSS variables in `globals.css`. Entity colors come from `entityColor(type)`; don't hard-code hex values in components.
- **`NEXT_PUBLIC_API_URL`** is baked in at build time. Changing it on Vercel requires a redeploy.

## Recipes

**Use a new endpoint**

1. Add the types to `types/index.ts`.
2. Add a method to `api` in `lib/api.ts`, using `apiPath()`.
3. Add a key to `queryKeys`.
4. Add a hook in `hooks/`.
5. Use it in a component and handle loading and error with `components/ui/states.tsx`. For errors, check `error instanceof ApiError` and `error.isNotFound`.

**Add a page:** create `src/app/<route>/page.tsx` and wrap it in `components/shell/Page.tsx`. Add it to `Sidebar` if it should be in the nav.

## Checks

`npm run check` runs typecheck, eslint, prettier check and vitest. `npm run build` must also pass, and CI runs both.
