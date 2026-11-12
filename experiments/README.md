# experiments/

Code here is **not part of the running app**. Nothing in `backend/` or `frontend/` imports it, CI does not build it, and it is not deployed.

| Folder | What it is | Status |
|---|---|---|
| `samvad/` | Samvād: a voice companion (speech-to-text, RAG, knowledge graph, its own FastAPI backend and Next.js frontend). | **Planned feature.** It will be folded into samā4 later. Until then, leave it untouched unless the task is about Samvād. |
| `mobile-card-prototype/` | An early full-page card-swiper design prototype (formerly `src-2/`). | Design reference only. |

When Samvād is integrated, port its pieces into `backend/app/` and `frontend/src/` with the layering described in `backend/CLAUDE.md` and `frontend/CLAUDE.md`. Don't import from this folder.
