import pytest

from agent.provider import FallbackProvider, ProviderError, build_provider_from_env


@pytest.fixture
def keys(monkeypatch):
    for name in ("GEMINI_API_KEY", "NVIDIA_API_KEY", "GROQ_API_KEY", "PROVIDER_ORDER"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "g")
    monkeypatch.setenv("NVIDIA_API_KEY", "n")
    return monkeypatch


def names(p: FallbackProvider) -> list[str]:
    return [x.name for x in p.providers]


def test_default_order_is_gemini_then_nvidia(keys):
    assert names(build_provider_from_env()) == ["gemini", "nvidia"]


def test_order_can_be_flipped(keys):
    keys.setenv("PROVIDER_ORDER", "nvidia,gemini")
    assert names(build_provider_from_env()) == ["nvidia", "gemini"]


def test_missing_key_is_skipped(keys):
    keys.delenv("GEMINI_API_KEY")
    assert names(build_provider_from_env()) == ["nvidia"]


def test_unknown_provider_is_rejected(keys):
    keys.setenv("PROVIDER_ORDER", "gemini,openai")
    with pytest.raises(ProviderError):
        build_provider_from_env()


class Boom:
    name = "boom"

    def complete(self, messages):
        raise ProviderError("503 high demand")


class Ok:
    name = "ok"

    def complete(self, messages):
        return "{}"


def test_falls_back_when_primary_is_down():
    p = FallbackProvider([Boom(), Ok()])
    assert p.complete([]) == "{}"
    assert p.name == "ok"
