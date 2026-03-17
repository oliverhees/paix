"""Marketplace Endpoints — browse, install, and submit skills & werkzeuge."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, update, or_
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from models.database import get_db
from models.marketplace import MarketplaceItem
from models.skill import SkillConfig
from models.mcp_server import McpServer
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# ──────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────


class MarketplaceSubmitRequest(BaseModel):
    type: str  # "skill" or "werkzeug"
    slug: str
    name: str
    description: str
    category: str
    icon: str = "⚡"
    # Skill fields
    skill_md: str | None = None
    # Werkzeug fields
    address: str | None = None
    requirements: dict | None = None
    hint: str | None = None


def _item_to_dict(item: MarketplaceItem) -> dict:
    """Serialize a MarketplaceItem ORM object to a response dict."""
    return {
        "id": str(item.id),
        "type": item.type,
        "slug": item.slug,
        "name": item.name,
        "description": item.description,
        "category": item.category,
        "icon": item.icon,
        "author": item.author,
        "version": item.version,
        "install_count": item.install_count,
        "featured": item.featured,
        "skill_md": item.skill_md,
        "address": item.address,
        "requirements": item.requirements,
        "hint": item.hint,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


# ──────────────────────────────────────────────
# Public Endpoints (no auth required)
# ──────────────────────────────────────────────


@router.get("/marketplace")
async def list_marketplace(
    type: str | None = Query(None, description="Filter by type: skill or werkzeug"),
    category: str | None = Query(None, description="Filter by category"),
    search: str | None = Query(None, description="Search in name and description"),
    featured: bool | None = Query(None, description="Filter featured items only"),
    db: AsyncSession = Depends(get_db),
):
    """List all marketplace items with optional filters."""
    query = select(MarketplaceItem)

    if type:
        query = query.where(MarketplaceItem.type == type)
    if category:
        query = query.where(MarketplaceItem.category == category)
    if featured is not None:
        query = query.where(MarketplaceItem.featured == featured)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                MarketplaceItem.name.ilike(search_pattern),
                MarketplaceItem.description.ilike(search_pattern),
            )
        )

    query = query.order_by(
        MarketplaceItem.featured.desc(),
        MarketplaceItem.install_count.desc(),
        MarketplaceItem.name.asc(),
    )

    result = await db.execute(query)
    items = list(result.scalars().all())

    # Collect unique categories for filter UI
    cat_result = await db.execute(
        select(MarketplaceItem.category).distinct()
    )
    categories = sorted([row[0] for row in cat_result.all()])

    return {
        "items": [_item_to_dict(i) for i in items],
        "total": len(items),
        "categories": categories,
    }


@router.get("/marketplace/{slug}")
async def get_marketplace_item(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single marketplace item by slug."""
    result = await db.execute(
        select(MarketplaceItem).where(MarketplaceItem.slug == slug)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Marketplace item '{slug}' not found",
        )
    return {"item": _item_to_dict(item)}


# ──────────────────────────────────────────────
# Auth-protected Endpoints
# ──────────────────────────────────────────────


@router.post("/marketplace/{slug}/install")
async def install_marketplace_item(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Install a marketplace item for the authenticated user.

    For skills: creates a SkillConfig copy.
    For werkzeuge: creates an McpServer copy.
    """
    result = await db.execute(
        select(MarketplaceItem).where(MarketplaceItem.slug == slug)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Marketplace item '{slug}' not found",
        )

    installed_id: str | None = None

    if item.type == "skill":
        # Create a SkillConfig for the user
        skill = SkillConfig(
            user_id=user.id,
            skill_id=item.slug,
            active=True,
            autonomy_level=3,
            name=item.name,
            description=item.description,
            skill_md=item.skill_md,
            category=item.category,
            icon=item.icon,
            is_custom=False,
            config={},
            allowed_tools=[],
            parameters={},
            metadata_json={"marketplace_slug": item.slug, "version": item.version},
        )
        db.add(skill)
        await db.flush()
        installed_id = str(skill.id)

    elif item.type == "werkzeug":
        # Determine transport type from address
        address = item.address or ""
        if address.startswith("http://") or address.startswith("https://"):
            transport_type = "streamable_http"
            config = {"url": address}
        else:
            # stdio (npx command)
            parts = address.split()
            transport_type = "stdio"
            config = {"command": parts[0], "args": parts[1:]} if parts else {"command": address}

        server = McpServer(
            user_id=user.id,
            name=item.name,
            description=item.description,
            transport_type=transport_type,
            config=config,
            tools=[],
            active=True,
        )
        db.add(server)
        await db.flush()
        installed_id = str(server.id)

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown marketplace item type: {item.type}",
        )

    # Increment install count
    await db.execute(
        update(MarketplaceItem)
        .where(MarketplaceItem.id == item.id)
        .values(install_count=MarketplaceItem.install_count + 1)
    )
    await db.flush()

    return {
        "installed": True,
        "type": item.type,
        "installed_id": installed_id,
        "message": f"{item.name} wurde erfolgreich installiert.",
    }


@router.post("/marketplace/submit", status_code=status.HTTP_201_CREATED)
async def submit_marketplace_item(
    request: MarketplaceSubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a new skill or werkzeug to the marketplace."""
    # Check for duplicate slug
    existing = await db.execute(
        select(MarketplaceItem).where(MarketplaceItem.slug == request.slug)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ein Item mit dem Slug '{request.slug}' existiert bereits.",
        )

    if request.type not in ("skill", "werkzeug"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type muss 'skill' oder 'werkzeug' sein.",
        )

    item = MarketplaceItem(
        type=request.type,
        slug=request.slug,
        name=request.name,
        description=request.description,
        category=request.category,
        icon=request.icon,
        author=user.email or "Community",
        skill_md=request.skill_md,
        address=request.address,
        requirements=request.requirements,
        hint=request.hint,
    )
    db.add(item)
    await db.flush()

    return {
        "item": _item_to_dict(item),
        "message": "Item wurde eingereicht.",
    }
