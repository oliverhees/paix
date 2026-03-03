"""Graphiti Knowledge Graph Service — client interface for the Graphiti API.

Communicates with the standalone Graphiti server (graphiti_server.py on port 8001).
Falls back gracefully with empty results when Graphiti is unavailable.
"""

import logging
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)


class GraphitiService:
    """
    Client for the Graphiti API service.
    Handles all knowledge graph operations: search, node CRUD, episode storage, TELOS.
    """

    def __init__(self) -> None:
        self.base_url = settings.graphiti_url
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create an async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=30.0,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ─── Init ───

    async def init(self) -> bool:
        """Initialize the Graphiti client. Returns True if healthy."""
        return await self.health()

    # ─── Search ───

    async def search(
        self,
        query: str,
        group_id: str | None = None,
        node_type: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Semantic search across the knowledge graph.
        Returns matching nodes with relevance scores.
        Graceful fallback: returns empty list if Graphiti is unreachable.
        """
        try:
            client = await self._get_client()
            params: dict[str, Any] = {"q": query, "limit": limit}
            if node_type:
                params["type"] = node_type
            if group_id:
                params["group_id"] = group_id

            response = await client.get("/search", params=params)
            response.raise_for_status()
            return response.json().get("results", [])
        except Exception as exc:
            logger.warning(f"Graphiti search failed: {exc}")
            return []

    # ─── Nodes ───

    async def get_node(self, node_id: str) -> dict[str, Any] | None:
        """Get a specific node by ID with its relations."""
        try:
            client = await self._get_client()
            response = await client.get(f"/nodes/{node_id}")
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.warning(f"Graphiti get_node failed: {exc}")
            return None

    async def get_nodes(
        self,
        node_type: str,
        group_id: str | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Get nodes filtered by type."""
        try:
            client = await self._get_client()
            params: dict[str, Any] = {"type": node_type, "limit": limit}
            if group_id:
                params["group_id"] = group_id
            response = await client.get("/nodes", params=params)
            response.raise_for_status()
            return response.json().get("nodes", [])
        except Exception as exc:
            logger.warning(f"Graphiti get_nodes failed: {exc}")
            return []

    async def create_node(
        self, node_type: str, data: dict[str, Any], group_id: str | None = None
    ) -> dict[str, Any]:
        """Create a new node in the knowledge graph."""
        try:
            client = await self._get_client()
            body: dict[str, Any] = {"type": node_type, "data": data}
            if group_id:
                body["group_id"] = group_id
            response = await client.post("/nodes", json=body)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.warning(f"Graphiti create_node failed: {exc}")
            return {"id": "", "status": "error", "error": str(exc)}

    async def update_node(
        self, node_id: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        """Update an existing node."""
        try:
            client = await self._get_client()
            response = await client.put(f"/nodes/{node_id}", json=data)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.warning(f"Graphiti update_node failed: {exc}")
            return {"status": "error", "error": str(exc)}

    # ─── Episodes ───

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
        Graphiti automatically extracts entities and relations.
        """
        try:
            client = await self._get_client()
            body: dict[str, Any] = {}
            if content:
                body["content"] = content
            if source:
                body["source"] = source
            if group_id:
                body["group_id"] = group_id
            if user_message:
                body["user_message"] = user_message
            if assistant_response:
                body["assistant_response"] = assistant_response
            if session_id:
                body["session_id"] = session_id
            if skill_used:
                body["skill_used"] = skill_used
            if entities_mentioned:
                body["entities_mentioned"] = entities_mentioned

            response = await client.post("/episodes", json=body)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.warning(f"Graphiti add_episode failed: {exc}")
            return {"id": "", "status": "error", "error": str(exc)}

    # ─── TELOS ───

    async def get_telos(self, user_id: str) -> dict[str, Any]:
        """Get all TELOS dimensions for a user."""
        try:
            client = await self._get_client()
            response = await client.get(f"/telos/{user_id}")
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.warning(f"Graphiti get_telos failed: {exc}")
            return {"dimensions": {}}

    async def get_telos_dimension(
        self, user_id: str, dimension: str
    ) -> dict[str, Any]:
        """Get all entries for a TELOS dimension."""
        try:
            client = await self._get_client()
            response = await client.get(f"/telos/{user_id}/{dimension}")
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.warning(f"Graphiti get_telos_dimension failed: {exc}")
            return {"dimension": dimension, "entries": []}

    async def update_telos(
        self, user_id: str, dimension: str, content: str
    ) -> dict[str, Any]:
        """Update a TELOS dimension with new content."""
        try:
            client = await self._get_client()
            response = await client.put(
                f"/telos/{user_id}/{dimension}",
                json={"content": content},
            )
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.warning(f"Graphiti update_telos failed: {exc}")
            return {"status": "error", "error": str(exc)}

    async def update_telos_entry(
        self,
        user_id: str,
        dimension: str,
        entry_id: str,
        content: str,
    ) -> dict[str, Any]:
        """Update a specific TELOS entry."""
        try:
            client = await self._get_client()
            response = await client.put(
                f"/telos/{user_id}/{dimension}/{entry_id}",
                json={"content": content},
            )
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.warning(f"Graphiti update_telos_entry failed: {exc}")
            return {"status": "error", "error": str(exc)}

    # ─── Health ───

    async def health(self) -> bool:
        """Check if the Graphiti service is healthy."""
        try:
            client = await self._get_client()
            response = await client.get("/health")
            return response.status_code == 200
        except Exception:
            return False


# Singleton instance
graphiti_service = GraphitiService()
