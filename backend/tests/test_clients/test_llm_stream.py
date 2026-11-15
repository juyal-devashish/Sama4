import logging
from types import SimpleNamespace

import pytest

from app.clients.llm import LLMClient, StreamEnd
from app.clients.usage import DailyBudgetExceeded, UsageMeter
from tests.fakes import MemoryCache


class FakeStream:
    def __init__(self, pieces, stop_reason="end_turn", tokens=(10, 20)):
        self.pieces, self.stop_reason, self.tokens = pieces, stop_reason, tokens

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    @property
    def text_stream(self):
        async def gen():
            for p in self.pieces:
                yield p

        return gen()

    async def get_final_message(self):
        return SimpleNamespace(
            stop_reason=self.stop_reason,
            stop_details=SimpleNamespace(category="x"),
            usage=SimpleNamespace(
                input_tokens=self.tokens[0],
                output_tokens=self.tokens[1],
                cache_creation_input_tokens=None,
                cache_read_input_tokens=0,
            ),
        )


def make(fake: FakeStream, cap: int = 0) -> tuple[LLMClient, MemoryCache]:
    cache = MemoryCache()
    llm = LLMClient("", "test-model", meter=UsageMeter(cache, cap))
    llm._client = SimpleNamespace(messages=SimpleNamespace(stream=lambda **kw: fake))  # type: ignore[assignment]
    return llm, cache


async def collect(llm: LLMClient) -> list:
    return [item async for item in llm.stream("hi")]


async def test_yields_the_pieces_then_the_whole_text_and_counts_the_tokens(caplog):
    llm, cache = make(FakeStream(["Hello ", "there."]))

    with caplog.at_level(logging.INFO, logger="app.clients.llm"):
        items = await collect(llm)

    assert items[:2] == ["Hello ", "there."]
    assert items[2] == StreamEnd("Hello there.")
    assert sum(v for k, v in cache.store.items() if k.startswith("llm:tokens:")) == 30
    assert any("first token after" in r.getMessage() for r in caplog.records)  # item 46


async def test_a_refusal_ends_with_empty_text():
    llm, _ = make(FakeStream(["Sorry"], stop_reason="refusal"))
    assert (await collect(llm))[-1] == StreamEnd("")


async def test_nothing_is_sent_once_the_daily_cap_is_used_up():
    llm, cache = make(FakeStream(["x"]), cap=15)
    await collect(llm)  # 30 tokens used: over the cap now

    with pytest.raises(DailyBudgetExceeded):
        await collect(llm)


async def test_without_a_key_it_reports_unavailable_instead_of_failing():
    llm = LLMClient("", "test-model")
    items = await collect(llm)
    assert len(items) == 1 and isinstance(items[0], StreamEnd)
