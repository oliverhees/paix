"""Marketplace Item SQLAlchemy Model — global skill/werkzeug catalog."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class MarketplaceItem(Base):
    """A public marketplace item (skill or werkzeug) available for installation."""

    __tablename__ = "marketplace_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # "skill" or "werkzeug"
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    icon: Mapped[str] = mapped_column(String(10), server_default="⚡")
    author: Mapped[str] = mapped_column(String(100), server_default="PAI-X Team")
    version: Mapped[str] = mapped_column(String(20), server_default="1.0.0")
    install_count: Mapped[int] = mapped_column(Integer, server_default="0")
    featured: Mapped[bool] = mapped_column(Boolean, server_default="false")

    # Skill-specific fields
    skill_md: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Werkzeug-specific fields
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    requirements: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<MarketplaceItem {self.slug} type={self.type}>"
