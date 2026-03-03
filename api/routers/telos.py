"""TELOS Endpoints — Identity Layer management with auth."""

import uuid as uuid_mod
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from models.database import get_db
from models.schemas import (
    TelosAllDimensionsResponse,
    TelosDimensionResponse,
    TelosEntryCreate,
    TelosEntryResponse,
)
from models.telos_snapshot import TelosSnapshot
from models.user import User
from services.graphiti_service import graphiti_service

router = APIRouter()

VALID_DIMENSIONS = [
    "mission",
    "goals",
    "projects",
    "beliefs",
    "models",
    "strategies",
    "narratives",
    "learned",
    "challenges",
    "ideas",
]


def _validate_dimension(dimension: str) -> str:
    """Validate that the dimension name is one of the 10 TELOS dimensions."""
    if dimension not in VALID_DIMENSIONS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown dimension '{dimension}'. Valid: {VALID_DIMENSIONS}",
        )
    return dimension


@router.get("/telos", response_model=TelosAllDimensionsResponse)
async def get_all_dimensions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all 10 TELOS dimensions with their entries."""
    user_id = str(user.id)
    dimensions: dict[str, list[TelosEntryResponse]] = {}
    latest_update: datetime | None = None

    for dim in VALID_DIMENSIONS:
        try:
            data = await graphiti_service.get_telos_dimension(user_id, dim)
            entries = [
                TelosEntryResponse(
                    id=e.get("id", ""),
                    content=e.get("content", ""),
                    source=e.get("source", "user"),
                    status=e.get("status", "active"),
                    created_at=e.get("created_at"),
                    updated_at=e.get("updated_at"),
                )
                for e in data.get("entries", [])
            ]
            dimensions[dim] = entries

            dim_updated = data.get("last_updated")
            if dim_updated and (latest_update is None or dim_updated > latest_update):
                latest_update = dim_updated
        except Exception:
            # Fallback: try PostgreSQL snapshot
            try:
                result = await db.execute(
                    select(TelosSnapshot)
                    .where(
                        TelosSnapshot.user_id == user.id,
                        TelosSnapshot.dimension == dim,
                    )
                    .order_by(TelosSnapshot.created_at.desc())
                    .limit(1)
                )
                snapshot = result.scalar_one_or_none()
                if snapshot and snapshot.content_json:
                    entries = [
                        TelosEntryResponse(**e)
                        for e in snapshot.content_json.get("entries", [])
                    ]
                    dimensions[dim] = entries
                else:
                    dimensions[dim] = []
            except Exception:
                dimensions[dim] = []

    return TelosAllDimensionsResponse(
        dimensions=dimensions,
        last_updated=latest_update,
    )


@router.get("/telos/{dimension}", response_model=TelosDimensionResponse)
async def get_dimension(
    dimension: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific TELOS dimension with all entries."""
    _validate_dimension(dimension)
    user_id = str(user.id)

    try:
        data = await graphiti_service.get_telos_dimension(user_id, dimension)
        entries = [
            TelosEntryResponse(
                id=e.get("id", ""),
                content=e.get("content", ""),
                source=e.get("source", "user"),
                status=e.get("status", "active"),
                created_at=e.get("created_at"),
                updated_at=e.get("updated_at"),
            )
            for e in data.get("entries", [])
        ]
        return TelosDimensionResponse(
            dimension=dimension,
            entries=entries,
            last_updated=data.get("last_updated"),
        )
    except Exception:
        # Fallback to PostgreSQL snapshot
        result = await db.execute(
            select(TelosSnapshot)
            .where(
                TelosSnapshot.user_id == user.id,
                TelosSnapshot.dimension == dimension,
            )
            .order_by(TelosSnapshot.created_at.desc())
            .limit(1)
        )
        snapshot = result.scalar_one_or_none()
        entries = []
        if snapshot and snapshot.content_json:
            entries = [
                TelosEntryResponse(**e)
                for e in snapshot.content_json.get("entries", [])
            ]
        return TelosDimensionResponse(
            dimension=dimension,
            entries=entries,
            last_updated=snapshot.created_at if snapshot else None,
        )


@router.put("/telos/{dimension}")
async def update_dimension(
    dimension: str,
    entries: list[TelosEntryCreate],
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update all entries in a TELOS dimension (user edit)."""
    _validate_dimension(dimension)
    user_id = str(user.id)

    updated_entries = []
    for entry in entries:
        try:
            result = await graphiti_service.create_node(
                node_type="TelosEntry",
                data={
                    "dimension": dimension,
                    "content": entry.content,
                    "source": "user",
                    "status": "active",
                    "metadata": entry.metadata or {},
                    "user_id": user_id,
                },
            )
            updated_entries.append({
                "id": result.get("id", ""),
                "content": entry.content,
                "source": "user",
                "status": "active",
            })
        except Exception:
            updated_entries.append({
                "id": str(uuid_mod.uuid4()),
                "content": entry.content,
                "source": "user",
                "status": "active",
            })

    # Save snapshot to PostgreSQL as backup
    snapshot = TelosSnapshot(
        user_id=user.id,
        dimension=dimension,
        content_json={"entries": updated_entries},
    )
    db.add(snapshot)
    await db.flush()

    return {"dimension": dimension, "entries": updated_entries}


@router.post(
    "/telos/{dimension}/entries",
    response_model=TelosEntryResponse,
    status_code=201,
)
async def add_entry(
    dimension: str,
    entry: TelosEntryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new entry to a TELOS dimension."""
    _validate_dimension(dimension)
    user_id = str(user.id)

    entry_id = str(uuid_mod.uuid4())
    try:
        result = await graphiti_service.create_node(
            node_type="TelosEntry",
            data={
                "dimension": dimension,
                "content": entry.content,
                "source": "user",
                "status": "active",
                "metadata": entry.metadata or {},
                "user_id": user_id,
            },
        )
        entry_id = result.get("id", entry_id)
    except Exception:
        pass

    return TelosEntryResponse(
        id=entry_id,
        content=entry.content,
        source="user",
        status="active",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


@router.delete("/telos/{dimension}/entries/{entry_id}", status_code=204)
async def delete_entry(
    dimension: str,
    entry_id: str,
    user: User = Depends(get_current_user),
):
    """Delete a TELOS entry."""
    _validate_dimension(dimension)
    # Graphiti does not have a direct delete — we mark as archived
    try:
        await graphiti_service.update_telos_entry(
            user_id=str(user.id),
            dimension=dimension,
            entry_id=entry_id,
            content="[ARCHIVED]",
        )
    except Exception:
        pass
    return None


@router.post("/telos/{dimension}/entries/{entry_id}/confirm")
async def confirm_entry(
    dimension: str,
    entry_id: str,
    user: User = Depends(get_current_user),
):
    """Confirm an agent-suggested TELOS entry."""
    _validate_dimension(dimension)
    try:
        await graphiti_service.update_telos_entry(
            user_id=str(user.id),
            dimension=dimension,
            entry_id=entry_id,
            content="",  # Content stays the same, status changes
        )
    except Exception:
        pass
    return {"message": "Entry confirmed"}


@router.post("/telos/{dimension}/agent")
async def agent_add_entry(
    dimension: str,
    entry: TelosEntryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Agent-initiated entry addition (shown as green in frontend).
    Entry is added with status 'review_needed' until user confirms.
    """
    _validate_dimension(dimension)
    user_id = str(user.id)

    entry_id = str(uuid_mod.uuid4())
    try:
        result = await graphiti_service.create_node(
            node_type="TelosEntry",
            data={
                "dimension": dimension,
                "content": entry.content,
                "source": "agent",
                "status": "review_needed",
                "metadata": entry.metadata or {},
                "user_id": user_id,
            },
        )
        entry_id = result.get("id", entry_id)
    except Exception:
        pass

    return TelosEntryResponse(
        id=entry_id,
        content=entry.content,
        source="agent",
        status="review_needed",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
