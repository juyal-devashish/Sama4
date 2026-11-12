"""Process-wide container of external clients.

Every external system (Claude, Pinecone, Redis, Wikimedia, MiroFish) is built
once here from Settings and shared. Request handlers get it through
`app.api.deps`; background jobs (scheduler, admin tasks) call `get_container()`.

Tests swap clients by building `Container(...)` with fakes and overriding the
`get_container` dependency (see tests/conftest.py).
"""

from dataclasses import dataclass
from functools import lru_cache

from app.clients.cache import Cache
from app.clients.llm import LLMClient
from app.clients.mirofish import MirofishClient
from app.clients.vectors import VectorStore
from app.clients.wikimedia import WikimediaClient
from app.config import Settings, settings


@dataclass
class Container:
    settings: Settings
    llm: LLMClient
    vectors: VectorStore
    cache: Cache
    wikimedia: WikimediaClient
    mirofish: MirofishClient

    @classmethod
    def from_settings(cls, s: Settings) -> "Container":
        return cls(
            settings=s,
            llm=LLMClient(s.anthropic_api_key, s.anthropic_model, s.anthropic_effort),
            vectors=VectorStore(
                api_key=s.pinecone_api_key,
                index_name=s.pinecone_index,
                region=s.pinecone_environment,
                embed_model=s.pinecone_embed_model,
                dimension=s.pinecone_embed_dim,
            ),
            cache=Cache(s.redis_url),
            wikimedia=WikimediaClient(),
            mirofish=MirofishClient(
                s.mirofish_url, s.mirofish_simulation_timeout, s.mirofish_enabled
            ),
        )

    async def aclose(self) -> None:
        await self.llm.aclose()
        await self.cache.aclose()
        await self.wikimedia.aclose()


@lru_cache(maxsize=1)
def get_container() -> Container:
    """The process-wide container (built lazily on first use)."""
    return Container.from_settings(settings)
