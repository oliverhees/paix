"""Chat Service — session and message persistence."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.session import ChatArtifact, ChatMessage, ChatSession


class ChatService:
    """Manages chat sessions and message persistence in PostgreSQL."""

    async def create_session(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        title: str | None = None,
    ) -> ChatSession:
        """Create a new chat session."""
        session = ChatSession(
            user_id=user_id,
            title=title,
            last_message_at=datetime.now(timezone.utc),
            message_count=0,
        )
        db.add(session)
        await db.flush()
        return session

    async def add_message(
        self,
        db: AsyncSession,
        session_id: uuid.UUID,
        role: str,
        content: str,
        skill_used: str | None = None,
        sources: list[dict] | None = None,
    ) -> ChatMessage:
        """Add a message to a session and update session counters."""
        message = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
            skill_used=skill_used,
            sources=sources,
            created_at=datetime.now(timezone.utc),  # Wall-clock time, not transaction time
        )
        db.add(message)

        # Update session counters
        await db.execute(
            update(ChatSession)
            .where(ChatSession.id == session_id)
            .values(
                message_count=ChatSession.message_count + 1,
                last_message_at=datetime.now(timezone.utc),
            )
        )
        await db.flush()
        return message

    async def get_session_messages(
        self,
        db: AsyncSession,
        session_id: uuid.UUID,
        limit: int = 50,
        before: uuid.UUID | None = None,
    ) -> list[ChatMessage]:
        """Get messages for a session with optional cursor pagination."""
        query = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
        if before:
            # Cursor-based pagination: get messages created before the given message
            subq = select(ChatMessage.created_at).where(ChatMessage.id == before)
            query = query.where(ChatMessage.created_at < subq.scalar_subquery())

        result = await db.execute(query)
        messages = list(result.scalars().all())
        # Return in chronological order
        messages.reverse()
        return messages

    async def list_sessions(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[ChatSession], int]:
        """List sessions for a user with total count."""
        # Count
        count_result = await db.execute(
            select(func.count())
            .select_from(ChatSession)
            .where(ChatSession.user_id == user_id)
        )
        total = count_result.scalar() or 0

        # Sessions ordered by most recent activity
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .order_by(ChatSession.last_message_at.desc().nullslast())
            .limit(limit)
            .offset(offset)
        )
        sessions = list(result.scalars().all())
        return sessions, total

    async def get_session(
        self,
        db: AsyncSession,
        session_id: uuid.UUID,
    ) -> ChatSession | None:
        """Get a session by ID."""
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def update_feedback(
        self,
        db: AsyncSession,
        message_id: uuid.UUID,
        rating: str,
        comment: str | None = None,
    ) -> bool:
        """Update feedback on a message. Returns True if found."""
        result = await db.execute(
            update(ChatMessage)
            .where(ChatMessage.id == message_id)
            .values(feedback_rating=rating, feedback_comment=comment)
        )
        return result.rowcount > 0

    async def auto_title(
        self,
        db: AsyncSession,
        session_id: uuid.UUID,
        first_message: str,
    ) -> None:
        """Set session title from the first user message (truncated)."""
        title = first_message[:80].strip()
        if len(first_message) > 80:
            title += "..."
        await db.execute(
            update(ChatSession)
            .where(ChatSession.id == session_id)
            .values(title=title)
        )

    # ── Artifact persistence ──

    async def save_artifact(
        self,
        db: AsyncSession,
        session_id: uuid.UUID,
        message_id: uuid.UUID,
        title: str,
        artifact_type: str,
        content: str,
        language: str | None = None,
    ) -> ChatArtifact:
        """Save an artifact linked to a session and message."""
        artifact = ChatArtifact(
            session_id=session_id,
            message_id=message_id,
            title=title,
            artifact_type=artifact_type,
            language=language,
            content=content,
        )
        db.add(artifact)
        await db.flush()
        return artifact

    async def get_session_artifacts(
        self,
        db: AsyncSession,
        session_id: uuid.UUID,
    ) -> list[ChatArtifact]:
        """Get all artifacts for a session, ordered by creation time."""
        result = await db.execute(
            select(ChatArtifact)
            .where(ChatArtifact.session_id == session_id)
            .order_by(ChatArtifact.created_at)
        )
        return list(result.scalars().all())


# Singleton
chat_service = ChatService()
