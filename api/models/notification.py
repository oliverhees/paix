"""Notification and NotificationSettings SQLAlchemy Models."""

import uuid
from datetime import datetime, time

from sqlalchemy import Boolean, DateTime, Integer, String, Text, Time, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class NotificationSettings(Base):
    """User notification preferences."""

    __tablename__ = "notification_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    daily_briefing_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    daily_briefing_time: Mapped[time] = mapped_column(
        Time, default=time(7, 30)
    )
    pre_meeting_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    pre_meeting_minutes: Mapped[int] = mapped_column(Integer, default=60)
    follow_up_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    follow_up_hours: Mapped[int] = mapped_column(Integer, default=48)
    deadline_warning_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    deadline_warning_hours: Mapped[int] = mapped_column(Integer, default=72)
    idea_synthesis_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    idea_synthesis_day: Mapped[str] = mapped_column(String(10), default="sunday")
    idea_synthesis_time: Mapped[time] = mapped_column(
        Time, default=time(10, 0)
    )
    channels: Mapped[dict] = mapped_column(
        JSONB,
        default={"telegram": True, "pwa_push": True, "email": False},
    )
    telegram_chat_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<NotificationSettings user={self.user_id}>"


class Notification(Base):
    """A single notification sent to a user."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    action_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_channels: Mapped[list] = mapped_column(JSONB, default=[])
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<Notification {self.id} type={self.type}>"
