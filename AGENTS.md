# AGENTS.md: working on samā4

Instructions for AI coding agents (and humans) changing this repo. Read this file first, then the `AGENTS.md` in the package you touch:

- [`backend/AGENTS.md`](backend/AGENTS.md): FastAPI API, ingestion pipeline, Claude/Pinecone clients
- [`frontend/AGENTS.md`](frontend/AGENTS.md): Next.js desktop reader

## What the product is

samā4 is a news reader that explains unfamiliar people, organizations, places and concepts **inline**. An hourly-ish pipeline pulls RSS news, finds the terms a reader probably doesn't know, and summarizes each article with Claude. In the app, tapping a highlighted term opens a short, sourced explanation.

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
2. **Tests never touch the network.** External clients (Claude, Pinecone, Redis, Wikimedia, MiroFish) are faked in `backend/tests/fakes.py`. The frontend unit-tests pure logic in `src/lib/*.test.ts`.
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
- **Admin endpoints** (`/api/v1/admin/*`) need the `X-Admin-Secret` header. `POST /api/v1/admin/summaries/regenerate` rewrites every summary after a prompt change.
