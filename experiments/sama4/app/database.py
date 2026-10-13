from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool

from app.config import settings

_is_sqlite = "sqlite" in settings.database_url

# SQLite needs StaticPool (single connection) to avoid "database is locked" errors
_engine_kwargs: dict = {}
if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    _engine_kwargs["poolclass"] = StaticPool
elif settings.database_ssl:
    import ssl as _ssl

    _ssl_ctx = _ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = _ssl.CERT_NONE
    _engine_kwargs["connect_args"] = {"ssl": _ssl_ctx}

engine = create_async_engine(
    settings.database_url,
    echo=(settings.environment == "development"),
    **_engine_kwargs,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

IS_SQLITE = "sqlite" in settings.database_url


class Base(DeclarativeBase):
    pass


async def create_tables() -> None:
    """Create all tables (used in dev with SQLite)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that provides a database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
