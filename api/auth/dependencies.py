"""FastAPI dependencies for authentication — single-user mode."""

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.user import User


async def get_default_user(
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Get the single default user. Creates one if none exists.
    PAIONE is single-user — no login required.
    """
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            email="admin@paione.local",
            password_hash="not-used-single-user",
            name="PAIONE User",
            is_active=True,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    return user


# Keep as alias for backward compatibility during migration
get_current_user = get_default_user
