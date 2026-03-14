"""TELOS Endpoints — Identity Layer management with auth.

TELOS data lives in PostgreSQL (TelosSnapshot table).
Knowledge Graph (Graphiti) is used separately for conversation learning.
"""

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


async def _get_dimension_entries(
    db: AsyncSession, user_id, dimension: str
) -> tuple[list[TelosEntryResponse], datetime | None]:
    """Load entries for a dimension from PostgreSQL."""
    result = await db.execute(
        select(TelosSnapshot)
        .where(
            TelosSnapshot.user_id == user_id,
            TelosSnapshot.dimension == dimension,
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
        return entries, snapshot.created_at
    return [], None


@router.get("/telos", response_model=TelosAllDimensionsResponse)
async def get_all_dimensions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all 10 TELOS dimensions with their entries."""
    dimensions: dict[str, list[TelosEntryResponse]] = {}
    latest_update: datetime | None = None

    for dim in VALID_DIMENSIONS:
        entries, updated_at = await _get_dimension_entries(db, user.id, dim)
        dimensions[dim] = entries
        if updated_at and (latest_update is None or updated_at > latest_update):
            latest_update = updated_at

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
    entries, updated_at = await _get_dimension_entries(db, user.id, dimension)

    return TelosDimensionResponse(
        dimension=dimension,
        entries=entries,
        last_updated=updated_at,
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

    updated_entries = []
    for entry in entries:
        updated_entries.append({
            "id": str(uuid_mod.uuid4()),
            "content": entry.content,
            "source": "user",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

    # Save snapshot to PostgreSQL
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

    # Load existing entries
    entries, _ = await _get_dimension_entries(db, user.id, dimension)
    existing = [
        {
            "id": e.id,
            "content": e.content,
            "source": e.source,
            "status": e.status,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "updated_at": e.updated_at.isoformat() if e.updated_at else None,
        }
        for e in entries
    ]

    # Add new entry
    entry_id = str(uuid_mod.uuid4())
    now = datetime.now(timezone.utc)
    new_entry = {
        "id": entry_id,
        "content": entry.content,
        "source": "user",
        "status": "active",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    existing.append(new_entry)

    # Save updated snapshot
    snapshot = TelosSnapshot(
        user_id=user.id,
        dimension=dimension,
        content_json={"entries": existing},
    )
    db.add(snapshot)
    await db.flush()

    return TelosEntryResponse(
        id=entry_id,
        content=entry.content,
        source="user",
        status="active",
        created_at=now,
        updated_at=now,
    )


@router.delete("/telos/{dimension}/entries/{entry_id}", status_code=204)
async def delete_entry(
    dimension: str,
    entry_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a TELOS entry."""
    _validate_dimension(dimension)

    entries, _ = await _get_dimension_entries(db, user.id, dimension)
    remaining = [
        {
            "id": e.id,
            "content": e.content,
            "source": e.source,
            "status": e.status,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "updated_at": e.updated_at.isoformat() if e.updated_at else None,
        }
        for e in entries
        if e.id != entry_id
    ]

    snapshot = TelosSnapshot(
        user_id=user.id,
        dimension=dimension,
        content_json={"entries": remaining},
    )
    db.add(snapshot)
    await db.flush()
    return None


@router.post("/telos/{dimension}/entries/{entry_id}/confirm")
async def confirm_entry(
    dimension: str,
    entry_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm an agent-suggested TELOS entry."""
    _validate_dimension(dimension)

    entries, _ = await _get_dimension_entries(db, user.id, dimension)
    updated = []
    for e in entries:
        entry_dict = {
            "id": e.id,
            "content": e.content,
            "source": e.source,
            "status": "active" if e.id == entry_id else e.status,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "updated_at": datetime.now(timezone.utc).isoformat()
            if e.id == entry_id
            else (e.updated_at.isoformat() if e.updated_at else None),
        }
        updated.append(entry_dict)

    snapshot = TelosSnapshot(
        user_id=user.id,
        dimension=dimension,
        content_json={"entries": updated},
    )
    db.add(snapshot)
    await db.flush()
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

    entries, _ = await _get_dimension_entries(db, user.id, dimension)
    existing = [
        {
            "id": e.id,
            "content": e.content,
            "source": e.source,
            "status": e.status,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "updated_at": e.updated_at.isoformat() if e.updated_at else None,
        }
        for e in entries
    ]

    entry_id = str(uuid_mod.uuid4())
    now = datetime.now(timezone.utc)
    new_entry = {
        "id": entry_id,
        "content": entry.content,
        "source": "agent",
        "status": "review_needed",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    existing.append(new_entry)

    snapshot = TelosSnapshot(
        user_id=user.id,
        dimension=dimension,
        content_json={"entries": existing},
    )
    db.add(snapshot)
    await db.flush()

    return TelosEntryResponse(
        id=entry_id,
        content=entry.content,
        source="agent",
        status="review_needed",
        created_at=now,
        updated_at=now,
    )
