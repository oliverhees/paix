"""Werkzeuge Endpoints — MCP Server Registry (CRUD) + Discovery + Execution."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from models.database import get_db
from models.mcp_server import McpServer
from models.user import User
from services.mcp_client import mcp_client_manager

logger = logging.getLogger(__name__)

router = APIRouter()

# Valid transport types per MCP specification
VALID_TRANSPORT_TYPES = {"stdio", "sse", "streamable_http"}


# ──────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────


class McpServerRequest(BaseModel):
    name: str
    description: str = ""
    transport_type: str  # "stdio" | "sse" | "streamable_http"
    config: dict = {}
    tools: list[str] = []

    @field_validator("transport_type")
    @classmethod
    def validate_transport_type(cls, v: str) -> str:
        if v not in VALID_TRANSPORT_TYPES:
            raise ValueError(
                f"transport_type must be one of: {', '.join(sorted(VALID_TRANSPORT_TYPES))}"
            )
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty")
        if len(v) > 100:
            raise ValueError("name must not exceed 100 characters")
        return v


def _server_to_dict(server: McpServer) -> dict:
    """Serialize a McpServer ORM object to a response dict."""
    return {
        "id": str(server.id),
        "name": server.name,
        "description": server.description,
        "transport_type": server.transport_type,
        "config": server.config,
        "tools": server.tools,
        "active": server.active,
        "created_at": server.created_at.isoformat() if server.created_at else None,
        "updated_at": server.updated_at.isoformat() if server.updated_at else None,
    }


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────


@router.get("/werkzeuge")
async def list_werkzeuge(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all registered MCP servers for the authenticated user."""
    result = await db.execute(
        select(McpServer)
        .where(McpServer.user_id == user.id)
        .order_by(McpServer.created_at.asc())
    )
    servers = list(result.scalars().all())
    return {"werkzeuge": [_server_to_dict(s) for s in servers]}


@router.post("/werkzeuge", status_code=status.HTTP_201_CREATED)
async def create_werkzeug(
    request: McpServerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new MCP server and auto-discover its tools."""
    server = McpServer(
        user_id=user.id,
        name=request.name,
        description=request.description,
        transport_type=request.transport_type,
        config=request.config,
        tools=request.tools,
        active=True,
    )
    db.add(server)
    await db.flush()

    # Auto-discover tools from the MCP server
    discovered_tools: list[dict] = []
    discovery_error: str | None = None
    try:
        discovered_tools = await mcp_client_manager.discover_tools(
            server_id=str(server.id),
            transport_type=server.transport_type,
            config=server.config or {},
        )
        if discovered_tools:
            await db.execute(
                update(McpServer)
                .where(McpServer.id == server.id)
                .values(tools=discovered_tools)
            )
            await db.flush()
            # Re-read to get updated tools
            result2 = await db.execute(
                select(McpServer).where(McpServer.id == server.id)
            )
            server = result2.scalar_one()
    except Exception as e:
        discovery_error = str(e)
        logger.warning("Auto-discover failed for %s: %s", request.name, e)

    return {
        "werkzeug": _server_to_dict(server),
        "discovered_tools": len(discovered_tools),
        "discovery_error": discovery_error,
    }


@router.put("/werkzeuge/{server_id}")
async def update_werkzeug(
    server_id: uuid.UUID,
    request: McpServerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing MCP server registration."""
    result = await db.execute(
        select(McpServer).where(
            McpServer.id == server_id,
            McpServer.user_id == user.id,
        )
    )
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Werkzeug '{server_id}' not found",
        )

    await db.execute(
        update(McpServer)
        .where(McpServer.id == server_id)
        .values(
            name=request.name,
            description=request.description,
            transport_type=request.transport_type,
            config=request.config,
            tools=request.tools,
        )
    )
    await db.flush()

    result = await db.execute(select(McpServer).where(McpServer.id == server_id))
    updated = result.scalar_one()
    return {"werkzeug": _server_to_dict(updated)}


@router.delete("/werkzeuge/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_werkzeug(
    server_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a registered MCP server."""
    result = await db.execute(
        select(McpServer).where(
            McpServer.id == server_id,
            McpServer.user_id == user.id,
        )
    )
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Werkzeug '{server_id}' not found",
        )

    await db.execute(
        delete(McpServer).where(McpServer.id == server_id)
    )
    await db.flush()


@router.get("/werkzeuge/{server_id}/tools")
async def list_werkzeug_tools(
    server_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all tools available on a specific MCP server."""
    result = await db.execute(
        select(McpServer).where(
            McpServer.id == server_id,
            McpServer.user_id == user.id,
        )
    )
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Werkzeug '{server_id}' not found",
        )

    # Tools may be stored as dicts (with schema) or strings (legacy)
    tool_names = []
    for tool in (server.tools or []):
        if isinstance(tool, dict):
            tool_names.append(tool.get("name", ""))
        else:
            tool_names.append(str(tool))

    tool_refs = [f"mcp__{server.name}__{name}" for name in tool_names]

    return {
        "server_id": str(server.id),
        "server_name": server.name,
        "transport_type": server.transport_type,
        "active": server.active,
        "tools": server.tools or [],
        "tool_refs": tool_refs,
    }


# ──────────────────────────────────────────────
# Discovery & Test Endpoints
# ──────────────────────────────────────────────


@router.post("/werkzeuge/{server_id}/discover")
async def discover_werkzeug_tools(
    server_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Connect to an MCP server and discover its tools.

    Fetches tool schemas via MCP tools/list and stores them in the DB.
    """
    result = await db.execute(
        select(McpServer).where(
            McpServer.id == server_id,
            McpServer.user_id == user.id,
        )
    )
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Werkzeug '{server_id}' not found",
        )

    try:
        tools = await mcp_client_manager.discover_tools(
            server_id=str(server.id),
            transport_type=server.transport_type,
            config=server.config or {},
        )
    except Exception as e:
        logger.warning("MCP discover failed for %s: %s", server.name, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Verbindung zum MCP Server fehlgeschlagen: {str(e)}",
        )

    # Store full tool schemas in DB
    await db.execute(
        update(McpServer)
        .where(McpServer.id == server_id)
        .values(tools=tools)
    )
    await db.flush()

    result = await db.execute(select(McpServer).where(McpServer.id == server_id))
    updated = result.scalar_one()

    return {
        "werkzeug": _server_to_dict(updated),
        "discovered_tools": len(tools),
    }


@router.post("/werkzeuge/{server_id}/test")
async def test_werkzeug_connection(
    server_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test connection to an MCP server without persisting anything."""
    result = await db.execute(
        select(McpServer).where(
            McpServer.id == server_id,
            McpServer.user_id == user.id,
        )
    )
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Werkzeug '{server_id}' not found",
        )

    test_result = await mcp_client_manager.test_connection(
        transport_type=server.transport_type,
        config=server.config or {},
    )

    return test_result
