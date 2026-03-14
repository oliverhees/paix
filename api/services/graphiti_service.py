"""Graphiti Knowledge Graph Service — native graphiti-core integration.

Uses graphiti-core SDK directly with FalkorDB as graph backend.
Anthropic for LLM inference, OpenAI for embeddings.
Falls back gracefully when FalkorDB is unavailable.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

# Lazy imports — graphiti-core may not be installed in all environments
_graphiti_available = False
try:
    from graphiti_core import Graphiti
    from graphiti_core.llm_client.anthropic_client import AnthropicClient
    from graphiti_core.llm_client.config import LLMConfig
    from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
    from graphiti_core.cross_encoder.openai_reranker_client import (
        OpenAIRerankerClient,
    )

    _graphiti_available = True
except ImportError:
    logger.warning(
        "graphiti-core not installed. Knowledge graph features disabled. "
        "Install with: pip install graphiti-core[anthropic,falkordb]"
    )

# FalkorDB driver is separate
_falkordb_available = False
try:
    from graphiti_core.driver.falkordb_driver import FalkorDriver

    _falkordb_available = True
except ImportError:
    logger.warning(
        "FalkorDB driver not available. "
        "Install with: pip install graphiti-core[falkordb]"
    )


class GraphitiService:
    """
    Native graphiti-core Knowledge Graph service.

    - Stores conversation episodes with automatic NLP entity extraction
    - Provides semantic search across all learned knowledge
    - Graceful degradation: returns empty results when unavailable
    """

    def __init__(self) -> None:
        self._graphiti: Any = None  # Graphiti instance
        self._initialized = False
        self._init_error: str | None = None

    @property
    def is_available(self) -> bool:
        """Whether the Knowledge Graph is connected and ready."""
        return self._initialized

    @property
    def init_error(self) -> str | None:
        """Last initialization error, if any."""
        return self._init_error

    # ─── Init ───

    async def init(self) -> bool:
        """
        Initialize graphiti-core with FalkorDB + Anthropic + OpenAI embeddings.
        Returns True if successful, False otherwise.
        """
        if self._initialized:
            return True

        if not _graphiti_available:
            self._init_error = "graphiti-core nicht installiert"
            return False

        if not _falkordb_available:
            self._init_error = "FalkorDB-Treiber nicht installiert"
            return False

        if not settings.anthropic_api_key:
            self._init_error = "ANTHROPIC_API_KEY nicht gesetzt"
            return False

        if not settings.openai_api_key:
            self._init_error = "OPENAI_API_KEY nicht gesetzt (für Embeddings)"
            return False

        try:
            # FalkorDB driver
            driver = FalkorDriver(
                host=settings.falkordb_host,
                port=settings.falkordb_port,
                database="paix_knowledge",
            )

            # Anthropic for NLP / entity extraction
            llm_client = AnthropicClient(
                config=LLMConfig(
                    api_key=settings.anthropic_api_key,
                    model="claude-sonnet-4-20250514",
                )
            )

            # OpenAI for embeddings (required by graphiti-core)
            embedder = OpenAIEmbedder(
                config=OpenAIEmbedderConfig(
                    api_key=settings.openai_api_key,
                    embedding_model="text-embedding-3-small",
                )
            )

            # OpenAI for reranking
            cross_encoder = OpenAIRerankerClient(
                config=LLMConfig(
                    api_key=settings.openai_api_key,
                    model="gpt-4.1-nano",
                )
            )

            self._graphiti = Graphiti(
                graph_driver=driver,
                llm_client=llm_client,
                embedder=embedder,
                cross_encoder=cross_encoder,
            )

            # Build indices on first run
            await self._graphiti.build_indices_and_constraints()

            self._initialized = True
            self._init_error = None
            logger.info(
                "Graphiti Knowledge Graph initialized (FalkorDB %s:%s)",
                settings.falkordb_host,
                settings.falkordb_port,
            )
            return True

        except Exception as exc:
            self._init_error = str(exc)
            logger.warning("Graphiti init failed: %s", exc)
            return False

    async def close(self) -> None:
        """Shut down the Graphiti connection."""
        if self._graphiti is not None:
            try:
                await self._graphiti.close()
            except Exception:
                pass
            self._graphiti = None
            self._initialized = False

    # ─── Episodes (Auto-Learning) ───

    async def add_episode(
        self,
        content: str | None = None,
        source: str | None = None,
        group_id: str | None = None,
        user_message: str | None = None,
        assistant_response: str | None = None,
        session_id: str | None = None,
        skill_used: str | None = None,
        entities_mentioned: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Store a conversation episode in the knowledge graph.
        Graphiti automatically extracts entities and relations via NLP.
        """
        if not self._initialized:
            return {"status": "unavailable"}

        # Build episode content from parts
        episode_body = content or ""
        if user_message:
            episode_body += f"\nUser: {user_message}"
        if assistant_response:
            episode_body += f"\nAssistant: {assistant_response}"

        if not episode_body.strip():
            return {"status": "empty"}

        # Build episode name
        name = f"chat-{session_id}" if session_id else "chat-episode"
        source_desc = "PAI-X Chat"
        if skill_used:
            source_desc += f" (Skill: {skill_used})"

        try:
            await self._graphiti.add_episode(
                name=name,
                episode_body=episode_body.strip(),
                source=source or "chat",
                source_description=source_desc,
                group_id=group_id or "default",
                reference_time=datetime.now(timezone.utc),
            )
            logger.debug("Episode stored: %s", name)
            return {"status": "stored", "name": name}
        except Exception as exc:
            logger.warning("Failed to store episode: %s", exc)
            return {"status": "error", "error": str(exc)}

    # ─── Search ───

    async def search(
        self,
        query: str,
        group_id: str | None = None,
        node_type: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Semantic hybrid search across the knowledge graph.
        Returns matching edges/facts with relevance scores.
        """
        if not self._initialized:
            return []

        try:
            results = await self._graphiti.search(
                query=query,
                group_ids=[group_id] if group_id else None,
                num_results=limit,
            )

            # Convert to dict format for backward compatibility
            return [
                {
                    "name": getattr(edge, "name", ""),
                    "content": getattr(edge, "fact", ""),
                    "summary": getattr(edge, "fact", ""),
                    "created_at": str(
                        getattr(edge, "created_at", "")
                    ),
                }
                for edge in results
            ]
        except Exception as exc:
            logger.warning("Graphiti search failed: %s", exc)
            return []

    # ─── TELOS Helper (PostgreSQL-backed, for backward compat) ───

    async def get_telos_dimension(
        self, user_id: str, dimension: str
    ) -> dict[str, Any]:
        """
        Get TELOS dimension entries from PostgreSQL.
        Kept for backward compatibility with callers that expect this interface.
        """
        try:
            from models.database import async_session
            from models.telos_snapshot import TelosSnapshot
            from sqlalchemy import select
            import uuid as uuid_mod

            user_uuid = uuid_mod.UUID(user_id)
            async with async_session() as db:
                result = await db.execute(
                    select(TelosSnapshot)
                    .where(
                        TelosSnapshot.user_id == user_uuid,
                        TelosSnapshot.dimension == dimension,
                    )
                    .order_by(TelosSnapshot.created_at.desc())
                    .limit(1)
                )
                snapshot = result.scalar_one_or_none()
                if snapshot and snapshot.content_json:
                    return {
                        "dimension": dimension,
                        "entries": snapshot.content_json.get("entries", []),
                        "last_updated": snapshot.created_at.isoformat()
                        if snapshot.created_at
                        else None,
                    }
        except Exception as exc:
            logger.warning("TELOS dimension load failed: %s", exc)

        return {"dimension": dimension, "entries": []}

    # ─── Status ───

    async def health(self) -> bool:
        """Check if the Knowledge Graph is connected and healthy."""
        return self._initialized

    async def get_status(self) -> dict[str, Any]:
        """Get detailed status for the Settings UI."""
        return {
            "connected": self._initialized,
            "error": self._init_error,
            "backend": "FalkorDB",
            "host": settings.falkordb_host,
            "port": settings.falkordb_port,
        }


# Singleton instance
graphiti_service = GraphitiService()
