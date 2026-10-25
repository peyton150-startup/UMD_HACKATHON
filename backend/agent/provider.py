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


DEFAULT_ORDER = "gemini,nvidia,groq"


def _gemini() -> ChatProvider | None:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    return OpenAICompatibleProvider(
        name="gemini",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
        api_key=key,
        model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash"),
        # thinking off: ~4s instead of ~14s, same valid JSON
        extra_body={"reasoning_effort": "none"},
    )


def _nvidia() -> ChatProvider | None:
    key = os.getenv("NVIDIA_API_KEY")
    if not key:
        return None
    return OpenAICompatibleProvider(
        name="nvidia",
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=key,
        model=os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b"),
        # Lightning "thinks" by default: ~30s and ~3k hidden tokens per call.
        # Off: ~6s with the same valid JSON. We validate the output in Python anyway.
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
    )


def _groq() -> ChatProvider | None:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return None
    return OpenAICompatibleProvider(
        name="groq",
        base_url="https://api.groq.com/openai/v1",
        api_key=key,
        model=os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
    )


_BUILDERS = {"gemini": _gemini, "nvidia": _nvidia, "groq": _groq}


def build_provider_from_env() -> FallbackProvider:
    """Providers in PROVIDER_ORDER (default gemini, then nvidia, then groq); keyless ones are skipped."""
    order = [n.strip().lower() for n in os.getenv("PROVIDER_ORDER", DEFAULT_ORDER).split(",")]
    unknown = [n for n in order if n not in _BUILDERS]
    if unknown:
        raise ProviderError(f"unknown provider(s) in PROVIDER_ORDER: {unknown}")
    providers = [p for n in order if (p := _BUILDERS[n]()) is not None]
    if not providers:
        raise ProviderError(
            "no model API key: set GEMINI_API_KEY and/or NVIDIA_API_KEY "
            "(.env locally, project Environment Variables on Vercel, then redeploy)"
        )
    return FallbackProvider(providers)
