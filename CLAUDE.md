# CLAUDE.md - samā4 / Samvād experiments branch

## Purpose

`feature/experimentation` contains only the backend algorithms of two projects, set up for experimentation in Jupyter notebooks. The full app (Next.js frontends, FastAPI routers and `main.py`, Docker/Alembic/CI/deploy config) lives on `main`. Don't reintroduce API or frontend code here.

```
experiments/
├── sama4/    # Poetry project: ingestion pipeline + entity RAG (OpenAI, Pinecone, spaCy, SQLAlchemy)
└── samvad/   # requirements.txt project: conversation agent + ChromaDB RAG + knowledge graph (Mistral)
```

Each folder is its own Python project whose import root is `app` (`from app.services... import ...`). Run code, tests and notebooks from inside the experiment folder, or `chdir` there and put it on `sys.path` as `notebooks/00_setup.ipynb` does.

## samā4 (`experiments/sama4`)

- `app/ingestion/`: `pipeline.py` (`IngestionPipeline().run()`) orchestrates fetcher → dedup (MinHash) → cleaner → ner (spaCy `en_core_web_trf`) → linker (Wikidata/Wikipedia) → summarizer (GPT-4o-mini) → embedder (Pinecone) → DB store. `sources.py` lists the RSS feeds.
- `app/services/context_service.py`: `ContextService.get_context(entity, db)` is the RAG pipeline (Redis cache → Pinecone → Wikipedia → LLM). `answer_followup` uses GPT-4o.
- Other services: `llm_service`, `embedding_service`/`embeddings`, `ner_service`, `entity_linker`, `wikidata`, `entity_service`, `cache_service` (works without Redis), `mirofish_service` + `prediction_service` (MiroFish simulations).
- `app/prompts/templates.py`: all LLM prompt templates. Ruff ignores E501 here.
- Services need `app/models/`, `app/database.py` (`async_session`, `create_tables`), `app/config.py`, `app/dbtypes.py` and `app/schemas/context.py`.
- Data: `minerva.db`, `minerva_dev.db` (SQLite). `config.py` defaults to Postgres, so set `DATABASE_URL=sqlite+aiosqlite:///<abs path>/minerva_dev.db`.
- Env: `OPENAI_API_KEY`, `PINECONE_API_KEY`. Optional: `REDIS_URL`, `MIROFISH_URL`.

```bash
cd experiments/sama4
poetry install && poetry run python -m spacy download en_core_web_trf
poetry run pytest -v
poetry run ruff check .
poetry run jupyter lab notebooks/
```

## Samvād (`experiments/samvad`)

- `app/services/conversation.py`: agent entry points `handle_message(session_id, message)`, `stream_handle_message`, `get_briefing`.
- `app/services/rag.py`: `retrieve_context`, `explain_entity`, `get_entity_context`, `get_entity_path_description`.
- `knowledge_graph.py` (NetworkX), `news.py` (`refresh_news_cache`), `hotness.py`, `entity_extractor.py`, `embedding.py`, `vector_store.py` (ChromaDB), `llm.py` (Mistral `get_client()`), `stt.py` (Mistral realtime STT).
- `app/prompts/intent.py`, `app/prompts/system.py`; `app/pipelines/scheduler.py` (APScheduler refresh).
- Data: `data/chroma_db/`. The path comes from `CHROMA_PERSIST_DIR` (default `./data/chroma_db`, relative to the cwd).
- Env: `MISTRAL_API_KEY`. Nothing calls `load_dotenv()` anymore (that used to happen in the deleted `main.py`), so notebooks must load `.env` themselves.

```bash
cd experiments/samvad
pip install -r requirements.txt
pytest tests/
jupyter lab notebooks/
```

## Conventions

- Python, type hints, async-first I/O, Pydantic v2, ruff.
- Put new experiments in `experiments/<project>/notebooks/` and number them (`01_...ipynb`).
- Conventional Commits (`feat(ingestion): ...`, `exp(samvad): ...`).
