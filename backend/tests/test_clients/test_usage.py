import logging
from types import SimpleNamespace

import pytest

from app.clients.llm import LLMClient, batch_job
from app.clients.usage import DailyBudgetExceeded, UsageMeter
from tests.fakes import MemoryCache


class FakeMessages:
    def __init__(self, tokens_in: int, tokens_out: int) -> None:
        self.tokens = (tokens_in, tokens_out)
        self.calls = 0

    async def create(self, **kwargs):
        self.calls += 1
        return SimpleNamespace(
            stop_reason="end_turn",
            content=[SimpleNamespace(type="text", text="ok")],
            usage=SimpleNamespace(
                input_tokens=self.tokens[0],
                output_tokens=self.tokens[1],
                cache_creation_input_tokens=None,
                cache_read_input_tokens=0,
            ),
        )


def make_llm(cap: int, tokens_in=600, tokens_out=400) -> tuple[LLMClient, FakeMessages]:
    llm = LLMClient("", "test-model", meter=UsageMeter(MemoryCache(), cap))
    messages = FakeMessages(tokens_in, tokens_out)
    llm._client = SimpleNamespace(messages=messages)  # type: ignore[assignment]
    return llm, messages


async def test_calls_are_counted_and_blocked_at_the_cap():
    llm, messages = make_llm(cap=2500)

    assert await llm.generate("a") == "ok"  # 1,000 used
    assert await llm.generate("b") == "ok"  # 2,000 used
    assert await llm.generate("c") == "ok"  # 3,000 used: over the cap now
    assert await llm.over_budget() is True
    with pytest.raises(DailyBudgetExceeded):
        await llm.generate("d")

    assert messages.calls == 3  # the blocked call never reached Claude


async def test_a_cap_of_zero_never_blocks():
    llm, _ = make_llm(cap=0)
    for _ in range(5):
        await llm.generate("x")
    assert await llm.over_budget() is False


async def test_batch_jobs_are_counted_but_not_blocked():
    llm, messages = make_llm(cap=500)
    await llm.generate("first")
    assert await llm.over_budget() is True

    @batch_job
    async def nightly() -> str:
        assert await llm.over_budget() is False
        return await llm.generate("ingestion")

    assert await nightly() == "ok"
    assert messages.calls == 2
    assert await llm.over_budget() is True  # readers are still paused afterwards


async def test_alerts_fire_once_at_80_and_100_percent(caplog):
    meter = UsageMeter(MemoryCache(), 1000)
    with caplog.at_level(logging.ERROR, logger="app.clients.usage"):
        await meter.record(700)
        await meter.record(100)  # 800: crosses 80%
        await meter.record(50)
        await meter.record(150)  # 1000: crosses 100%
        await meter.record(500)

    messages = [r.getMessage() for r in caplog.records]
    assert len(messages) == 2
    assert "80%" in messages[0] and "100%" in messages[1]
    assert "paused" in messages[1]


async def test_no_redis_means_no_blocking():
    from app.clients.cache import Cache

    meter = UsageMeter(Cache(""), 10)
    await meter.record(1_000_000)
    assert await meter.exceeded() is False
