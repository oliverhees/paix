"""Provider factory — resolves model names to providers and manages singletons."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from services.llm_providers.base import LLMProvider

# ── Model catalogue ──────────────────────────────

AVAILABLE_MODELS: dict[str, list[dict]] = {
    "anthropic": [
        {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "context": 200_000},
        {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5", "context": 200_000},
        {"id": "claude-opus-4-6", "name": "Claude Opus 4.6", "context": 200_000},
    ],
    "openai": [
        {"id": "gpt-4o", "name": "GPT-4o", "context": 128_000},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "context": 128_000},
        {"id": "o3-mini", "name": "o3 Mini", "context": 200_000},
    ],
    "google": [
        {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "context": 1_000_000},
        {"id": "gemini-2.0-flash-lite", "name": "Gemini 2.0 Flash Lite", "context": 1_000_000},
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "context": 2_000_000},
    ],
}


def resolve_provider(model: str, provider: str | None = None) -> str:
    """
    Resolve which provider to use based on an explicit value or model name prefix.
    Falls back to ``"anthropic"`` when nothing matches.
    """
    if provider:
        return provider
    if model.startswith("claude"):
        return "anthropic"
    if model.startswith(("gpt-", "o3", "o1")):
        return "openai"
    if model.startswith("gemini"):
        return "google"
    return "anthropic"  # default


# ── Singleton provider instances ──────────────────

_provider_instances: dict[str, "LLMProvider"] = {}


def get_provider(provider_name: str) -> "LLMProvider":
    """Return a singleton provider instance for the given name."""
    if provider_name not in _provider_instances:
        if provider_name == "anthropic":
            from services.llm_providers.anthropic_provider import AnthropicProvider
            _provider_instances[provider_name] = AnthropicProvider()
        elif provider_name == "openai":
            from services.llm_providers.openai_provider import OpenAIProvider
            _provider_instances[provider_name] = OpenAIProvider()
        elif provider_name == "google":
            from services.llm_providers.google_provider import GoogleProvider
            _provider_instances[provider_name] = GoogleProvider()
        else:
            raise ValueError(f"Unknown LLM provider: {provider_name}")
    return _provider_instances[provider_name]


async def close_all_providers() -> None:
    """Close every instantiated provider."""
    for p in _provider_instances.values():
        await p.close()
    _provider_instances.clear()
