"""Chat Endpoints — delegates to ChatEngine via Channel Adapters."""

import logging
import uuid

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.jwt import decode_token
from models.database import get_db, async_session
from models.schemas import (
    ChatFeedbackRequest,
    ChatMessageRequest,
    ChatMessageResponse,
    ChatSessionListResponse,
    ChatSessionSummary,
)
from models.user import User
from services.chat_service import chat_service
from services.chat_engine import chat_engine
from services.channel_adapters.web_adapter import WebSocketAdapter

logger = logging.getLogger(__name__)

router = APIRouter()


# ──────────────────────────────────────────────
# POST /chat — synchronous
# ──────────────────────────────────────────────

@router.post("/chat", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a chat message (synchronous, non-streaming)."""
    model = request.model if request.model else "claude-sonnet-4-6"
    result = await chat_engine.process(
        user=user,
        message=request.message,
        session_id=request.session_id,
        model=model,
        db=db,
    )
    return ChatMessageResponse(
        id=result["message_id"],
        session_id=result["session_id"],
        content=result["text"],
        skill_used=result["skill_used"],
        sources=[],
        artifact=result.get("artifact"),
        created_at=result.get("created_at"),
    )


# ──────────────────────────────────────────────
# WebSocket /chat/stream
# ──────────────────────────────────────────────

@router.websocket("/chat/stream")
async def chat_stream(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """WebSocket endpoint for real-time chat streaming."""
    # Authenticate
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.close(code=4001, reason="Invalid token type")
            return
        user_id_str = payload["sub"]
        user_id = uuid.UUID(user_id_str)
    except (JWTError, KeyError, ValueError):
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()
    adapter = WebSocketAdapter(websocket)

    try:
        while True:
            data = await websocket.receive_json()

            msg_type = data.get("type", "message")
            if msg_type != "message":
                continue

            content = data.get("content", "")
            session_id_str = data.get("session_id")
            model = data.get("model", "claude-sonnet-4-6")

            if not content:
                await adapter.send_event({
                    "type": "error",
                    "message": "Empty message",
                    "code": "EMPTY_MESSAGE",
                })
                continue

            async with async_session() as db:
                # Load user for persona
                user_result = await db.execute(
                    select(User).where(User.id == user_id)
                )
                user_obj = user_result.scalar_one()

                try:
                    await chat_engine.process_stream(
                        adapter=adapter,
                        user=user_obj,
                        message=content,
                        session_id=session_id_str,
                        model=model,
                        db=db,
                    )
                except Exception as exc:
                    await adapter.send_event({
                        "type": "error",
                        "message": f"LLM error: {str(exc)}",
                        "code": "LLM_ERROR",
                    })

    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close(code=1011, reason="Internal error")
        except Exception:
            pass


# ──────────────────────────────────────────────
# GET /chat/sessions
# ──────────────────────────────────────────────

@router.get("/chat/sessions", response_model=ChatSessionListResponse)
async def list_sessions(
    limit: int = 20,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all chat sessions for the current user."""
    limit = min(limit, 100)
    sessions, total = await chat_service.list_sessions(db, user.id, limit, offset)

    return ChatSessionListResponse(
        sessions=[
            ChatSessionSummary(
                id=str(s.id),
                title=s.title,
                last_message_at=s.last_message_at,
                message_count=s.message_count,
                created_at=s.created_at,
            )
            for s in sessions
        ],
        total=total,
    )


# ──────────────────────────────────────────────
# GET /chat/sessions/{session_id}/messages
# ──────────────────────────────────────────────

@router.get("/chat/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    limit: int = 50,
    before: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get messages for a specific chat session."""
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        return {"messages": []}

    session = await chat_service.get_session(db, sid)
    if session is None or session.user_id != user.id:
        return {"messages": []}

    before_uuid = None
    if before:
        try:
            before_uuid = uuid.UUID(before)
        except ValueError:
            pass

    messages = await chat_service.get_session_messages(
        db, sid, limit=min(limit, 100), before=before_uuid
    )

    # Load all artifacts for this session and group by message_id
    all_artifacts = await chat_service.get_session_artifacts(db, sid)
    artifacts_by_message: dict[str, list[dict]] = {}
    for art in all_artifacts:
        msg_key = str(art.message_id)
        if msg_key not in artifacts_by_message:
            artifacts_by_message[msg_key] = []
        artifacts_by_message[msg_key].append({
            "id": str(art.id),
            "title": art.title,
            "artifact_type": art.artifact_type,
            "language": art.language,
            "content": art.content,
        })

    return {
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "skill_used": m.skill_used,
                "sources": m.sources or [],
                "artifacts": artifacts_by_message.get(str(m.id), []),
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ]
    }


# ──────────────────────────────────────────────
# POST /chat/feedback
# ──────────────────────────────────────────────

@router.post("/chat/feedback")
async def submit_feedback(
    request: ChatFeedbackRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit feedback for a chat message."""
    try:
        msg_id = uuid.UUID(request.message_id)
    except ValueError:
        return {"message": "Invalid message ID"}

    await chat_service.update_feedback(db, msg_id, request.rating, request.comment)
    return {"message": "Feedback saved"}
