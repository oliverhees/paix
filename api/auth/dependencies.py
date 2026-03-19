"""FastAPI dependencies for authentication — single-user mode."""

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.user import User


async def get_default_user(
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Get the single default user.
    Returns 503 if no user exists yet (setup wizard not completed).
    PAIONE is single-user — no login required after setup.
    """
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=503,
            detail="Setup not completed. Please complete the setup wizard first.",
        )

    return user


# Keep as alias for backward compatibility during migration
get_current_user = get_default_user
