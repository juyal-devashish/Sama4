# samā4 developer commands. Run `make help` for the list.
# Backend: Python 3.11+ via Poetry. Frontend: Node 20+ via npm.

.DEFAULT_GOAL := help
.PHONY: help install infra-up infra-down dev-backend dev-frontend seed ingest \
        test test-backend test-frontend lint format check build-backend build-frontend \
        deploy-backend clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ---- Setup ----------------------------------------------------------------
install: ## Install backend + frontend dependencies
	cd backend && poetry install
	cd backend && poetry run python -m spacy download en_core_web_sm
	cd frontend && npm ci

infra-up: ## Start local Postgres + Redis (docker compose)
	docker compose up -d

infra-down: ## Stop local Postgres + Redis
	docker compose down

# ---- Run (use two terminals) ------------------------------------------------
dev-backend: ## API on :8000 with reload (needs `make infra-up`, or DATABASE_URL=sqlite+aiosqlite:///./dev.db)
	cd backend && poetry run uvicorn app.main:app --reload --port 8000

dev-frontend: ## Next.js on :3000
	cd frontend && npm run dev

seed: ## Insert sample articles into the local DB
	cd backend && poetry run python -m app.seed

ingest: ## Run the news ingestion pipeline once against the local DB
	cd backend && poetry run python -c "import asyncio; from app.container import get_container; from app.ingestion.jobs import run_ingestion; print(asyncio.run(run_ingestion(get_container())), 'articles')"

# ---- Quality gates (CI runs exactly these) ----------------------------------
test: test-backend test-frontend ## All tests

test-backend: ## pytest (no network; external clients are faked)
	cd backend && poetry run pytest

test-frontend: ## vitest
	cd frontend && npm test

lint: ## ruff + eslint + format checks
	cd backend && poetry run ruff check . && poetry run ruff format --check .
	cd frontend && npm run lint && npm run typecheck && npm run format:check

format: ## Auto-format backend + frontend
	cd backend && poetry run ruff check --fix . && poetry run ruff format .
	cd frontend && npm run format

check: lint test ## Everything CI checks. Run before every commit.

# ---- Build / deploy ---------------------------------------------------------
build-backend: ## Build the production Docker image
	cd backend && docker build -t sama4-api .

build-frontend: ## Production Next.js build
	cd frontend && npm run build

deploy-backend: ## Deploy backend/ to Railway (service sama4-api)
	cd backend && railway up --no-gitignore --service sama4-api --ci

clean: ## Remove caches and build output
	find . -type d \( -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache \) -prune -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/htmlcov frontend/.next
