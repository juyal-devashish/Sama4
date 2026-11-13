# backend/AGENTS.md

FastAPI + async SQLAlchemy 2 + Pydantic v2, Python 3.11 (Poetry). Read the root [`AGENTS.md`](../AGENTS.md) first.

## Layout and dependency direction

```
app/
  main.py          create_app(); lifespan creates tables, starts the scheduler, closes clients
  config.py        Settings (env vars; every knob lives here)
  container.py     Container: builds each external client ONCE from Settings
  api/
    deps.py        DbSession, ContainerDep, ContextServiceDep, AdminOnly … (all DI lives here)
    routers/       HTTP only: parse input, call a repo/service, map to a schema
  services/        business logic (context.py = the core feature, predictions.py)
  repositories/    ALL SQL. Plain async functions taking `db` first
  clients/         one module per external system: llm (Claude), vectors (Pinecone),
                   cache (Redis), wikimedia, mirofish. No business rules, no SQL
  ingestion/       pipeline steps (fetch → dedup → rank → clean → NER → link → summarize → embed)
    sources.py     the RSS feeds, each tagged with a region for the ranker
    ranker.py      Claude picks the day's 12-15 stories before anything costly runs
    pipeline.py    IngestionPipeline(container, session_factory)
    jobs.py        run_ingestion / regenerate_summaries / … used by scheduler + admin
  models/          SQLAlchemy ORM models
  schemas/         Pydantic request/response models (the API contract)
  prompts/         prompt templates
```

**Allowed imports:** `api → services → repositories, clients`. `ingestion` uses `repositories` and `clients`. `clients` and `repositories` never import from `api`, `services` or `ingestion`. Nothing reads `settings` at import time except `config.py`, `database.py` and `container.py`; everything else gets values through constructors or `Container`.

## Recipes

**Add an endpoint**
1. Add Pydantic models in `schemas/`.
2. Add queries in `repositories/<thing>.py`.
3. If there's logic beyond mapping, add or extend a service in `services/`, taking clients through `__init__`, and add a provider in `api/deps.py`.
4. Add the route in `api/routers/` using `DbSession` / `…Dep`. If it's a new router, register it in `main.create_app()`.
5. Add tests in `tests/test_api/` using the `client`, `container` and `db_session` fixtures and `tests/factories.py`.
6. Update `frontend/src/types/index.ts` and `frontend/src/lib/api.ts`.

**Call Claude**: `await container.llm.generate(prompt, effort="low" | "medium", system=...)`.
- Use `low` for high-volume short outputs and `medium` for reader-facing reasoning.
- It returns `""` if Claude declines, so handle that.
- Don't pass `temperature`: Opus 5.5 rejects sampling parameters.
- Put prompts in `prompts/templates.py` or next to the step that owns them (see `ingestion/summarizer.py`).

**Add an external service**
1. Create `clients/<name>.py` with a class configured through `__init__`, which no-ops or returns "unavailable" when it isn't configured.
2. Add it to `Container.from_settings` (and `aclose` if it holds connections).
3. Add a fake to `tests/fakes.py` and to `make_container()`.

**Add a pipeline step**: add a class in `ingestion/` and build it in `IngestionPipeline.__init__` from the container. Each article runs inside a savepoint, so raising drops only that article.

**Add a background job**: add a function in `ingestion/jobs.py` that takes `container`, opens its own sessions and never raises. Then schedule it in `ingestion/scheduler.py` or trigger it from `api/routers/admin.py`.

## Testing

- `make test-backend` runs pytest.
- `tests/conftest.py` blanks every API key, uses in-memory SQLite by default (CI uses Postgres), recreates the schema for each test, and injects a `Container` of fakes.
- To control Claude's output in a test, set `container.llm.default` or `container.llm.replies = {"substring of prompt": "reply"}`. Read `container.llm.calls` to assert on prompts and effort.
- spaCy isn't needed in tests: the NER tests mock `nlp`, and the pipeline tests mock `extract_entities_hybrid`.

## Gotchas

- **Dedup** (`ingestion/dedup.py`) drops articles whose *titles* are 85% or more similar, so test fixtures need distinct titles.
- **Pinecone vector ids** are `article_<uuid>`. Use `clients.vectors.article_id_from_vector_id`, because the uuid is not in the metadata.
- **SQLite and Postgres differences** are handled in `dbtypes.py` (GUID, StringArray) and in `repositories/articles.list_feed` (the category filter).
- **`search` endpoint** is a stub that returns nothing. Implementing it is a good first task: `VectorStore.search` → article ids → `repositories.articles`.
- **Production config is in Railway variables**, not in code. See `.env.example` for the full list.
