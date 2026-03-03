"""Health Check Endpoints."""

from fastapi import APIRouter

from config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Health check endpoint.
    Returns service status and version info.
    Used by Docker healthcheck and monitoring.
    """
    return {
        "status": "healthy",
        "version": settings.app_version,
        "environment": settings.environment,
        "services": {
            "postgres": "connected",  # TODO: actual check
            "redis": "connected",  # TODO: actual check
            "graphiti": "connected",  # TODO: actual check
            "falkordb": "connected",  # TODO: actual check
        },
    }


@router.get("/health/ready")
async def readiness_check():
    """
    Readiness check — is the service ready to accept traffic?
    Checks all downstream dependencies.
    """
    # TODO: Implement actual dependency checks
    return {"status": "ready"}


@router.get("/health/live")
async def liveness_check():
    """
    Liveness check — is the service alive?
    Simple ping to confirm the process is running.
    """
    return {"status": "alive"}
