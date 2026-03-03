"""LLM Service — Multi-provider facade with backward-compatible API surface.

All existing callers (chat.py, routine_executor_service.py, etc.) continue to
work unchanged.  Internally each call is routed to the correct provider
(Anthropic / OpenAI / Google) via the factory.
"""

import logging
import uuid
from typing import Any, AsyncGenerator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.llm_providers.base import ToolUseResult  # canonical location
from services.llm_providers.factory import (
    AVAILABLE_MODELS,
    close_all_providers,
    get_provider,
    resolve_provider,
)

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 3

# Re-export so that ``from services.llm_service import ToolUseResult`` still works.
__all__ = ["ToolUseResult", "LLMService", "llm_service", "get_user_anthropic_key", "get_user_api_key", "AVAILABLE_MODELS"]


# ── Key helpers ──────────────────────────────────

async def get_user_anthropic_key(user_id: uuid.UUID, db: AsyncSession) -> str | None:
    """Fetch the user's stored Anthropic API key from integration_tokens.

    Kept for backward compatibility — delegates to ``get_user_api_key``.
    """
    return await get_user_api_key(user_id, db, "anthropic")


async def get_user_api_key(
    user_id: uuid.UUID,
    db: AsyncSession,
    provider: str = "anthropic",
) -> str | None:
    """Fetch any provider's API key for a user from integration_tokens."""
    from models.integration import IntegrationToken

    result = await db.execute(
        select(IntegrationToken.access_token).where(
            IntegrationToken.user_id == user_id,
            IntegrationToken.provider == provider,
        )
    )
    return result.scalar_one_or_none()


# ── Facade ───────────────────────────────────────

class LLMService:
    """
    Thin facade that keeps the exact same public API as before.

    Every call resolves the correct provider from the ``model`` name (or an
    explicit ``provider`` parameter) and delegates.  Per-API-key client pooling
    is handled inside each provider.
    """

    # ── complete ─────────────────────────────────

    async def complete(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
        provider: str | None = None,
    ) -> str:
        p = get_provider(resolve_provider(model, provider))
        return await p.complete(
            messages=messages,
            system_prompt=system_prompt,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            api_key=api_key,
            tools=tools,
        )

    # ── complete_raw ─────────────────────────────

    async def complete_raw(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
        provider: str | None = None,
    ) -> Any:
        p = get_provider(resolve_provider(model, provider))
        return await p.complete_raw(
            messages=messages,
            system_prompt=system_prompt,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            api_key=api_key,
            tools=tools,
        )

    # ── complete_with_tool_handling ───────────────

    async def complete_with_tool_handling(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
        tool_executor: Any = None,
        provider: str | None = None,
    ) -> ToolUseResult:
        p = get_provider(resolve_provider(model, provider))
        return await p.complete_with_tool_handling(
            messages=messages,
            system_prompt=system_prompt,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            api_key=api_key,
            tools=tools,
            tool_executor=tool_executor,
        )

    # ── stream ───────────────────────────────────

    async def stream(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 4096,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
        provider: str | None = None,
    ) -> AsyncGenerator[str, None]:
        p = get_provider(resolve_provider(model, provider))
        async for chunk in p.stream(
            messages=messages,
            system_prompt=system_prompt,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            api_key=api_key,
            tools=tools,
        ):
            yield chunk

    # ── stream_raw_events ────────────────────────

    async def stream_raw_events(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 16384,
        temperature: float = 0.7,
        api_key: str | None = None,
        tools: list[dict] | None = None,
        provider: str | None = None,
    ) -> AsyncGenerator[dict, None]:
        p = get_provider(resolve_provider(model, provider))
        async for event in p.stream_raw_events(
            messages=messages,
            system_prompt=system_prompt,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            api_key=api_key,
            tools=tools,
        ):
            yield event

    # ── close ────────────────────────────────────

    async def close(self) -> None:
        """Close all provider clients."""
        await close_all_providers()


# Singleton instance
llm_service = LLMService()
