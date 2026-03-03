"""Agent State model — persistent key-value store for agent memory per user."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class AgentState(Base):
    """Persistent agent state entry per user (key-value store)."""

    __tablename__ = "agent_state"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)  # JSON-encoded value
    scope: Mapped[str] = mapped_column(
        String(50), default="global", server_default="global"
    )  # "global" or "session"
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_agent_state_user_key", "user_id", "key", unique=True),
        Index("ix_agent_state_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<AgentState user={self.user_id} key={self.key!r}>"
