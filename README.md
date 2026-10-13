# Sama4: experiments branch

This branch (`feature/experimentation`) holds only the backend algorithms of samā4 and Samvād, for notebook experiments. The full app (frontends, API servers, deploy config) is still on `main`.

```
experiments/
├── sama4/    # Contextual news intelligence: ingestion pipeline + entity RAG
└── samvad/   # Voice news companion: news cache, ChromaDB RAG, knowledge graph, conversation agent
```

Each folder is self-contained and has its own dependencies, tests, data and a `notebooks/00_setup.ipynb` starter.

## samā4 (`experiments/sama4`)

```
RSS Fetch → MinHash Dedup → HTML Clean → spaCy NER (en_core_web_trf)
→ Wikidata/Wikipedia Link → GPT-4o-mini Summarize → Pinecone Embed → DB Store

Entity → Redis cache → Pinecone retrieval → Wikipedia → LLM context (GPT-4o-mini / GPT-4o follow-ups)
```

| Path | What |
|------|------|
| `app/ingestion/` | Full ingestion pipeline (`pipeline.py` orchestrates) |
| `app/services/` | RAG context, LLM, embeddings, NER, entity linking, Wikidata, cache, MiroFish predictions |
| `app/prompts/templates.py` | LLM prompt templates |
| `app/models/`, `app/schemas/context.py` | ORM models and context schema the services depend on |
| `app/run_pipeline.py`, `app/resummarize.py`, `app/seed.py` | Script entry points |
| `minerva.db`, `minerva_dev.db` | Local SQLite data |

```bash
cd experiments/sama4
poetry install
poetry run python -m spacy download en_core_web_trf
poetry run jupyter lab notebooks/
```

Needs `OPENAI_API_KEY` and `PINECONE_API_KEY`. The notebook points `DATABASE_URL` at `minerva_dev.db` by default. Redis is optional; the cache service falls back when it isn't running.

## Samvād (`experiments/samvad`)

| Path | What |
|------|------|
| `app/services/conversation.py` | Conversation agent (`handle_message`, `stream_handle_message`, `get_briefing`) |
| `app/services/rag.py` | Retrieval over ChromaDB, entity explanations, graph paths |
| `app/services/knowledge_graph.py` | NetworkX entity graph |
| `app/services/news.py`, `hotness.py` | News fetching and story ranking |
| `app/services/entity_extractor.py`, `embedding.py`, `vector_store.py`, `llm.py`, `stt.py` | Extraction, embeddings, Chroma store, Mistral LLM, speech-to-text |
| `app/prompts/` | Intent and system prompts |
| `app/pipelines/scheduler.py` | Periodic refresh job |
| `data/chroma_db/` | Persisted vector store |

```bash
cd experiments/samvad
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
jupyter lab notebooks/
```

Needs `MISTRAL_API_KEY`.

## Environment

Copy `.env.example` to `.env` at the repo root or inside an experiment folder. The notebooks load both.
