# AGENTS.md: working on Samā4

Instructions for AI coding agents (and humans) changing this repo. Read this file first, then the `AGENTS.md` in the package you touch:

- [`backend/AGENTS.md`](backend/AGENTS.md): FastAPI API, ingestion pipeline, Claude/Pinecone clients
- [`frontend/AGENTS.md`](frontend/AGENTS.md): Next.js desktop reader

## What the product is

Samā4 is a news reader that explains unfamiliar people, organizations, places and concepts **inline**. A nightly pipeline (03:00 New York) pulls the last 24 hours of RSS news from US, Indian, world and tech outlets, has Claude pick the 12-15 most consequential stories (`backend/app/ingestion/ranker.py`), keeps each picked story's text to what its outlet's terms allow (the feed's own text unless `excerpt_words` in `ingestion/sources.py` permits reading the page; see `docs/feed-terms.md`), finds the terms a reader probably doesn't know, and writes a brief of at most 60 words with Claude. In the app, tapping a highlighted term opens a short, sourced explanation.

## Repo map

```
backend/        FastAPI API + ingestion pipeline (Python 3.11, Poetry)   -> Railway
frontend/       Next.js 14 desktop reader (TypeScript, React Query)       -> Vercel
experiments/    NOT part of the app: Samvād voice companion (planned feature) and an old prototype
docs/           Design prompts and product/technical notes
Makefile        Every dev command. `make help`
```

## Commands

| Task | Command |
|---|---|
| Install everything | `make install` |
| Local Postgres + Redis | `make infra-up` |
| Run API / web | `make dev-backend` / `make dev-frontend` (two terminals) |
| **Before every commit** | `make check`: lint, format check, typecheck and tests. This is exactly what CI runs. |
| Auto-format | `make format` |
| Deploy backend | `make deploy-backend` (Railway). The frontend auto-deploys from `main` via Vercel. |

## Rules

1. **Keep `make check` green.** CI (`.github/workflows/ci.yml`) runs the same steps; backend tests also run against Postgres there.
2. **Tests never touch the network.** External clients (Claude, Pinecone, Redis, Wikimedia, MiroFish, article pages) are faked in `backend/tests/fakes.py`. The frontend unit-tests pure logic in `src/lib/*.test.ts`.
3. **Respect the layering** described in each package's AGENTS.md. Don't call external APIs or write SQL from routers or components.
4. **Don't import from `experiments/`.** To bring Samvād in, port its code into `backend/` and `frontend/` following their layering.
5. **Small commits, conventional messages**: `feat(scope): …`, `fix(scope): …`, `refactor(scope): …`, `chore(scope): …`, `docs: …`.
6. **Never commit secrets.** `.env` is gitignored, and the variables are documented in `.env.example`. Production secrets live in Railway and Vercel.
7. **The API contract is shared.** If you change a response in `backend/app/schemas/`, update `frontend/src/types/index.ts` in the same change.

## Production facts that are easy to get wrong

- **The backend deploys with `railway up --no-gitignore`.** Without that flag, Railway's uploader silently drops `backend/app/models/` and the app crashes on import.
- **There are no database migrations.** Startup runs `create_all`, which only creates missing tables. Additive changes (new tables, new nullable columns on new tables) are fine. Changing or removing an existing column needs Alembic first; ask before doing that.
- **The LLM is Claude** (`claude-opus-5-5`), called only through `backend/app/clients/llm.py`. Claude has no embeddings API, so embeddings come from **Pinecone Inference** (`llama-text-embed-v2`, 1024-d, index `sama4-articles-v2`).
- **MiroFish** (the prediction engine) is a separate service and is **off in production** (`MIROFISH_ENABLED=false`). Prediction endpoints fall back to Claude.
- **Domains:** the app is served at `www.sama4.online` (Vercel project `frontend`; `sama4.online` redirects to it). DNS is at Namecheap with Mail Settings set to "No Email Service". The `_vercel` TXT record verifies the domain for this project; don't remove it.
- **Admin endpoints** (`/api/v1/admin/*`) need the `X-Admin-Secret` header. `POST /api/v1/admin/summaries/regenerate` rewrites every summary after a prompt change. `POST /api/v1/admin/articles/enrich?limit=100` re-reads the newest stories' pages (image, excerpt, terms, brief). `POST /api/v1/admin/mentions/repair` fixes stored highlight offsets (dry run by default; `?dry_run=false` to write, `&delete_unlocatable=true` also deletes mentions whose text isn't in the article). `GET /api/v1/admin/reports` lists readers' "Report an error" submissions (open ones by default; `?status=` for all). **Publisher opt-out:** add the domain to the `BLOCKED_PUBLISHERS` Railway variable (ingestion and /sources skip it), then `POST /api/v1/admin/publishers/purge?domain=ft.com` (dry run by default; `&dry_run=false` deletes its stored stories and vectors).
