"""Pydantic Request/Response Schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Chat Schemas
# ──────────────────────────────────────────────

class ChatMessageRequest(BaseModel):
    """Request body for sending a chat message."""

    message: str = Field(..., min_length=1, max_length=10000)
    session_id: str | None = None
    model: str | None = None


class ArtifactResponse(BaseModel):
    """Response body for a chat artifact."""

    id: str
    title: str
    artifact_type: str
    language: str | None = None
    content: str


class ChatMessageResponse(BaseModel):
    """Response body for a chat message."""

    id: str
    session_id: str
    content: str
    skill_used: str | None = None
    sources: list[dict] = []
    artifact: dict | None = None
    artifacts: list[ArtifactResponse] = []
    created_at: datetime | None = None


class ChatSessionSummary(BaseModel):
    """Summary of a chat session for listing."""

    id: str
    title: str | None = None
    last_message_at: datetime | None = None
    message_count: int = 0
    created_at: datetime | None = None


class ChatSessionListResponse(BaseModel):
    """Response for listing chat sessions."""

    sessions: list[ChatSessionSummary]
    total: int


class ChatFeedbackRequest(BaseModel):
    """Request body for submitting feedback."""

    message_id: str
    rating: str = Field(..., pattern="^(positive|negative)$")
    comment: str | None = None


# ──────────────────────────────────────────────
# WebSocket Message Schemas
# ──────────────────────────────────────────────

class WSMessage(BaseModel):
    """Incoming WebSocket message."""

    type: str = "message"
    content: str = ""
    session_id: str | None = None


class WSChunk(BaseModel):
    """Outgoing WebSocket chunk."""

    type: str = "chunk"
    content: str
    session_id: str
    message_id: str


class WSEnd(BaseModel):
    """Outgoing WebSocket end signal."""

    type: str = "end"
    message_id: str
    skill_used: str | None = None
    sources: list[dict] = []


class WSError(BaseModel):
    """Outgoing WebSocket error."""

    type: str = "error"
    message: str
    code: str


# ──────────────────────────────────────────────
# TELOS Schemas
# ──────────────────────────────────────────────

class TelosEntryCreate(BaseModel):
    """Request body for creating a TELOS entry."""

    content: str = Field(..., min_length=1)
    metadata: dict | None = None


class TelosEntryResponse(BaseModel):
    """Response body for a TELOS entry."""

    id: str
    content: str
    source: str = "user"  # 'user' | 'agent'
    status: str = "active"  # 'active' | 'review_needed' | 'completed' | 'archived'
    created_at: datetime | None = None
    updated_at: datetime | None = None


class TelosDimensionResponse(BaseModel):
    """Response body for a single TELOS dimension."""

    dimension: str
    entries: list[TelosEntryResponse]
    last_updated: datetime | None = None


class TelosAllDimensionsResponse(BaseModel):
    """Response body for all TELOS dimensions."""

    dimensions: dict[str, list[TelosEntryResponse]]
    last_updated: datetime | None = None


# ──────────────────────────────────────────────
# Memory Schemas
# ──────────────────────────────────────────────

class MemorySearchResult(BaseModel):
    """A single search result from the Knowledge Graph."""

    node_id: str
    type: str
    name: str
    summary: str | None = None
    relevance_score: float = 0.0
    created_at: datetime | None = None


class MemorySearchResponse(BaseModel):
    """Response body for memory search."""

    results: list[MemorySearchResult]
    total: int
    query: str


# ──────────────────────────────────────────────
# Health Schemas
# ──────────────────────────────────────────────

class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str
    services: dict[str, str]


# ──────────────────────────────────────────────
# Calendar Schemas
# ──────────────────────────────────────────────

class CalendarEventResponse(BaseModel):
    """Response body for a calendar event."""

    id: str
    title: str
    start: datetime
    end: datetime
    participants: list[dict] = []
    location: str | None = None
    context: dict | None = None


class BriefingResponse(BaseModel):
    """Response body for the daily briefing."""

    date: str
    greeting: str
    events: list[dict] = []
    priorities: list[dict] = []
    open_items: list[dict] = []
    idea_of_the_day: dict | None = None
