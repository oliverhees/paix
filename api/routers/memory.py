"""Memory Endpoints — Graphiti Knowledge Graph search and status, with auth."""

from fastapi import APIRouter, Depends

from auth.dependencies import get_current_user
from models.user import User
from services.graphiti_service import graphiti_service

router = APIRouter()


@router.get("/memory/search")
async def search_memory(
    q: str,
    limit: int = 10,
    user: User = Depends(get_current_user),
):
    """
    Semantic search through the Knowledge Graph.
    Uses graphiti-core hybrid search (semantic + BM25).
    """
    limit = min(limit, 50)

    try:
        results = await graphiti_service.search(query=q, limit=limit)
        return {
            "results": results,
            "total": len(results),
            "query": q,
        }
    except Exception:
        return {"results": [], "total": 0, "query": q}


@router.get("/memory/status")
async def memory_status(
    user: User = Depends(get_current_user),
):
    """Get Knowledge Graph connection status for Settings UI."""
    return await graphiti_service.get_status()
