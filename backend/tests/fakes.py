"""In-memory stand-ins for every external client. No network, no keys.

Build a test container with `make_container()`; override fields per test, e.g.
`container.llm.replies["summary"] = "..."`.
"""

from dataclasses import dataclass, field

from app.clients.cache import Cache
from app.clients.mirofish import MirofishClient
from app.config import Settings
from app.container import Container


@dataclass
class FakeLLM:
    """Records prompts; replies with the first matching canned answer, else `default`."""

    available: bool = True
    default: str = "Generated text."
    replies: dict[str, str] = field(default_factory=dict)  # substring-of-prompt -> reply
    calls: list[dict] = field(default_factory=list)

    async def generate(self, prompt: str, **kwargs) -> str:
        self.calls.append({"prompt": prompt, **kwargs})
        for needle, reply in self.replies.items():
            if needle in prompt:
                return reply
        return self.default

    async def aclose(self) -> None:
        pass


@dataclass
class FakeVectors:
    available: bool = True
    matches: list[dict] = field(default_factory=list)
    upserts: list[dict] = field(default_factory=list)

    async def upsert_article(self, **kwargs) -> bool:
        self.upserts.append(kwargs)
        return True

    async def search(self, query: str, top_k: int = 5) -> list[dict]:
        return self.matches[:top_k]


@dataclass
class FakeWikimedia:
    extract: str | None = "A short Wikipedia extract."

    async def search_wikidata(self, text: str) -> str | None:
        return None

    async def get_wikipedia_url(self, wikidata_id: str) -> str | None:
        return None

    async def get_wikipedia_extract(self, url: str) -> str | None:
        return self.extract

    async def aclose(self) -> None:
        pass


class MemoryCache(Cache):
    """Cache backed by a dict (exercises cache hits without Redis)."""

    def __init__(self) -> None:
        super().__init__("")
        self.store: dict[str, object] = {}

    async def get(self, key: str):
        return self.store.get(key)

    async def set(self, key: str, value, ttl: int | None = None) -> None:
        self.store[key] = value

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)

    async def hit(self, key: str, window_seconds: int) -> int | None:
        self.store[key] = int(self.store.get(key, 0)) + 1  # type: ignore[arg-type]
        return int(self.store[key])  # type: ignore[arg-type]


def make_container(settings: Settings | None = None) -> Container:
    s = settings or Settings(admin_secret="test-secret", environment="test")
    return Container(
        settings=s,
        llm=FakeLLM(),  # type: ignore[arg-type]
        vectors=FakeVectors(),  # type: ignore[arg-type]
        cache=MemoryCache(),
        wikimedia=FakeWikimedia(),  # type: ignore[arg-type]
        mirofish=MirofishClient("http://mirofish.invalid", 1, enabled=False),
    )
