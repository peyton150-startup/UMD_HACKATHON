"""LLM providers behind one interface, with ordered fallback.

NVIDIA and Groq both expose OpenAI-compatible /chat/completions endpoints,
so one small class covers both. The model ids come from the environment so
you can switch models without touching code.
"""

import os
from dataclasses import dataclass, field
from typing import Protocol

import httpx


class ProviderError(RuntimeError):
    pass


class ChatProvider(Protocol):
    name: str

    def complete(self, messages: list[dict]) -> str: ...


@dataclass
class OpenAICompatibleProvider:
    name: str
    base_url: str
    api_key: str
    model: str
    timeout_s: float = 30.0  # fail over to the next provider reasonably quickly
    extra_body: dict = field(default_factory=dict)  # provider-specific request options

    def complete(self, messages: list[dict]) -> str:
        try:
            resp = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    **self.extra_body,
                },
                timeout=self.timeout_s,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError) as exc:
            raise ProviderError(f"{self.name}: {exc}") from exc


@dataclass
class FallbackProvider:
    """Try each provider in order; the first success wins."""

    providers: list[ChatProvider]
    last_used: str = ""

    @property
    def name(self) -> str:
        return self.last_used or "none"

    def complete(self, messages: list[dict]) -> str:
        errors = []
        for provider in self.providers:
            try:
                text = provider.complete(messages)
                self.last_used = provider.name
                return text
            except ProviderError as exc:
                errors.append(str(exc))
        raise ProviderError("all providers failed: " + " | ".join(errors))


def build_provider_from_env() -> FallbackProvider:
    providers: list[ChatProvider] = []
    if key := os.getenv("NVIDIA_API_KEY"):
        providers.append(
            OpenAICompatibleProvider(
                name="nvidia",
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=key,
                model=os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b"),
                # Lightning "thinks" by default: ~30s and ~3k hidden tokens per call.
                # Off: ~6s with the same valid JSON. We validate the output in Python anyway.
                extra_body={"chat_template_kwargs": {"enable_thinking": False}},
            )
        )
    if key := os.getenv("GROQ_API_KEY"):
        providers.append(
            OpenAICompatibleProvider(
                name="groq",
                base_url="https://api.groq.com/openai/v1",
                api_key=key,
                model=os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
            )
        )
    if not providers:
        raise ProviderError("set NVIDIA_API_KEY and/or GROQ_API_KEY in .env")
    return FallbackProvider(providers)
