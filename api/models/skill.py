"""Skill Config and Skill Execution SQLAlchemy Models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from models.database import Base


class SkillConfig(Base):
    """Per-user skill configuration."""

    __tablename__ = "skill_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    skill_id: Mapped[str] = mapped_column(String(100), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    autonomy_level: Mapped[int] = mapped_column(Integer, default=3)
    config: Mapped[dict] = mapped_column(JSONB, default=dict)

    # ── Agent Skills Open Standard fields ──────────────────────────────────
    # Display name (e.g. "Kalender-Briefing")
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Human-readable description and trigger text
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # The actual system prompt used when executing this skill
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    # MCP tool references the skill is allowed to use,
    # e.g. ["mcp__github__create_issue", "mcp__linear__create_task"]
    allowed_tools: Mapped[list] = mapped_column(JSONB, default=list)
    # Parameter schema definitions, e.g. {"topic": {"type": "string", "required": true}}
    parameters: Mapped[dict] = mapped_column(JSONB, default=dict)
    # True for user-created skills, False for seeded default skills
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    # Category, icon (emoji), and default output path
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(10), nullable=True)
    output_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Anthropic Skills Open Standard – full SKILL.md content (YAML frontmatter + markdown body)
    skill_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Author, version, tags, etc.
    metadata_json: Mapped[dict] = mapped_column(
        "skill_metadata", JSONB, default=dict
    )
    # ───────────────────────────────────────────────────────────────────────

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<SkillConfig {self.skill_id} user={self.user_id}>"


class SkillExecution(Base):
    """Log of a single skill execution."""

    __tablename__ = "skill_executions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    skill_id: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    input_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(
        "metadata", JSONB, default={}
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<SkillExecution {self.skill_id} status={self.status}>"
