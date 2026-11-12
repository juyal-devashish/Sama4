from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.clients.llm import FALLBACK_BETA, LLMClient


def _response(text: str, stop_reason: str = "end_turn"):
    return SimpleNamespace(
        stop_reason=stop_reason,
        stop_details=None,
        content=[
            SimpleNamespace(type="thinking", thinking=""),
            SimpleNamespace(type="text", text=text),
        ],
    )


def _client(model: str) -> tuple[LLMClient, MagicMock]:
    llm = LLMClient(api_key="test", model=model, default_effort="low")
    sdk = MagicMock()
    sdk.messages.create = AsyncMock(return_value=_response("plain"))
    sdk.beta.messages.create = AsyncMock(return_value=_response("with fallback"))
    llm._client = sdk
    return llm, sdk


async def test_haiku_uses_plain_messages_api_without_fallback():
    llm, sdk = _client("claude-haiku-5-5")

    assert await llm.generate("hi", system="sys") == "plain"

    sdk.beta.messages.create.assert_not_called()
    kwargs = sdk.messages.create.call_args.kwargs
    assert kwargs["model"] == "claude-haiku-5-5"
    assert kwargs["output_config"] == {"effort": "low"}
    assert kwargs["system"] == "sys"
    assert "fallbacks" not in kwargs and "betas" not in kwargs
    assert "temperature" not in kwargs


@pytest.mark.parametrize("model", ["claude-opus-5-5", "claude-sonnet-5-5"])
async def test_fallback_models_use_beta_with_server_fallback(model):
    llm, sdk = _client(model)

    assert await llm.generate("hi", effort="medium") == "with fallback"

    sdk.messages.create.assert_not_called()
    kwargs = sdk.beta.messages.create.call_args.kwargs
    assert kwargs["betas"] == [FALLBACK_BETA]
    assert kwargs["fallbacks"] == "default"
    assert kwargs["output_config"] == {"effort": "medium"}


async def test_refusal_returns_empty_string():
    llm, sdk = _client("claude-haiku-5-5")
    sdk.messages.create.return_value = _response("", stop_reason="refusal")
    assert await llm.generate("hi") == ""
