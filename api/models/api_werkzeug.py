"""API Werkzeug SQLAlchemy Model — REST API tool registry."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class ApiWerkzeug(Base):
    """Registered REST API tool for a user.

    Each API werkzeug defines a base URL and a list of endpoint definitions
    that become tools in the chat. Example endpoints:

        [
            {
                "name": "get_weather",
                "description": "Get weather for a city",
                "method": "GET",
                "path": "/weather",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {"type": "string", "description": "City name"}
                    },
                    "required": ["city"]
                }
            }
        ]
    """

    __tablename__ = "api_werkzeuge"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="")
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    # Auth: {"type": "bearer", "token": "..."} or {"type": "header", "key": "X-API-Key", "value": "..."}
    auth: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Default headers to send with every request
    headers: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Endpoint definitions — each becomes a tool in the chat
    endpoints: Mapped[list] = mapped_column(JSONB, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<ApiWerkzeug {self.name} user={self.user_id}>"
