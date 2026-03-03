"""MCP Server SQLAlchemy Model — Werkzeuge-Registry for registered MCP servers."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class McpServer(Base):
    """Registered MCP server (Werkzeug) for a user."""

    __tablename__ = "mcp_servers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Display name, e.g. "github", "linear"
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="")
    # Transport: "stdio" | "sse" | "streamable_http"
    transport_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Connection config: url, command, args, env vars
    config: Mapped[dict] = mapped_column(JSONB, default=dict)
    # List of available tool names, e.g. ["read_file", "create_issue"]
    tools: Mapped[list] = mapped_column(JSONB, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<McpServer {self.name} user={self.user_id}>"
