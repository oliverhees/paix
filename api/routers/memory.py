"""Memory Endpoints — Graphiti Knowledge Graph search and access, with auth."""

from fastapi import APIRouter, Depends

from auth.dependencies import get_current_user
from models.user import User
from services.graphiti_service import graphiti_service

router = APIRouter()


@router.get("/memory/search")
async def search_memory(
    q: str,
    type: str | None = None,
    since: str | None = None,
    limit: int = 10,
    user: User = Depends(get_current_user),
):
    """
    Semantic search through the Knowledge Graph.
    Searches across persons, meetings, projects, ideas, tasks, documents.
    """
    limit = min(limit, 50)

    try:
        results = await graphiti_service.search(
            query=q, node_type=type, limit=limit
        )
        return {
            "results": results,
            "total": len(results),
            "query": q,
        }
    except Exception:
        return {"results": [], "total": 0, "query": q}


@router.get("/memory/nodes/{node_id}")
async def get_node(
    node_id: str,
    user: User = Depends(get_current_user),
):
    """Get a specific node from the Knowledge Graph with its relations."""
    try:
        node = await graphiti_service.get_node(node_id)
        if node is None:
            return {"node": None, "relations": []}
        return {
            "node": node.get("node", node),
            "relations": node.get("relations", []),
        }
    except Exception:
        return {"node": None, "relations": []}


@router.get("/memory/persons")
async def list_persons(
    limit: int = 20,
    user: User = Depends(get_current_user),
):
    """List all person nodes in the Knowledge Graph."""
    limit = min(limit, 100)
    try:
        results = await graphiti_service.search(
            query="person", node_type="Person", limit=limit
        )
        return {"persons": results, "total": len(results)}
    except Exception:
        return {"persons": [], "total": 0}


@router.get("/memory/persons/{person_id}")
async def get_person(
    person_id: str,
    user: User = Depends(get_current_user),
):
    """
    Get a person with full context:
    - Recent meetings
    - Shared projects
    - Assigned tasks
    - Last contact info
    """
    try:
        node_data = await graphiti_service.get_node(person_id)
        if node_data is None:
            return {
                "person": None,
                "meetings": [],
                "projects": [],
                "tasks": [],
                "last_contact": None,
            }

        person = node_data.get("node", node_data)
        relations = node_data.get("relations", [])

        meetings = [r for r in relations if r.get("type") == "Meeting"]
        projects = [r for r in relations if r.get("type") == "Project"]
        tasks = [r for r in relations if r.get("type") == "Task"]

        return {
            "person": person,
            "meetings": meetings,
            "projects": projects,
            "tasks": tasks,
            "last_contact": person.get("last_contact"),
        }
    except Exception:
        return {
            "person": None,
            "meetings": [],
            "projects": [],
            "tasks": [],
            "last_contact": None,
        }
