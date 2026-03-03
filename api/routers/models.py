"""Models Endpoint — exposes available LLM models for frontend dropdowns."""

from fastapi import APIRouter

from services.llm_providers.factory import AVAILABLE_MODELS

router = APIRouter()


@router.get("/chat/models")
async def list_models():
    """Return all available LLM models grouped by provider."""
    return AVAILABLE_MODELS
