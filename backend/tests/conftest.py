"""Shared fixtures. Tests never touch real external services.

- External API keys are blanked before the app is imported.
- DATABASE_URL defaults to in-memory SQLite (CI may point it at Postgres).
- `container` is a Container of fakes, injected into the app for every test.
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ["ENVIRONMENT"] = "test"
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["PINECONE_API_KEY"] = ""
os.environ["REDIS_URL"] = ""
os.environ["SENTRY_DSN"] = ""

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.container import Container, get_container  # noqa: E402
from app.database import Base, async_session, create_tables, engine  # noqa: E402
from app.main import app  # noqa: E402
from tests.fakes import make_container  # noqa: E402


@pytest.fixture(autouse=True)
async def _fresh_db():
    """Empty schema for every test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await create_tables()
    yield


@pytest.fixture
def container() -> Container:
    return make_container()


@pytest.fixture(autouse=True)
def _inject_container(container: Container):
    app.dependency_overrides[get_container] = lambda: container
    yield
    app.dependency_overrides.clear()


@pytest.fixture
async def client():
    """Async HTTP client for the app (lifespan not run; tables come from _fresh_db)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def db_session():
    """Factory for sessions bound to the test database: `async with db_session() as db`."""
    return async_session
