"""Routine SQLAlchemy Models — scheduled autonomous AI tasks."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.database import Base


class Routine(Base):
    """A scheduled, autonomous AI task definition."""

    __tablename__ = "routines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ---- Definition ----
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    system_prompt_override: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Schedule ----
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Europe/Berlin")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # ---- Execution Config ----
    max_tokens: Mapped[int] = mapped_column(Integer, default=8192)
    model: Mapped[str] = mapped_column(String(50), default="claude-sonnet-4-6")
    temperature: Mapped[float] = mapped_column(Float, default=0.7)
    max_tool_rounds: Mapped[int] = mapped_column(Integer, default=3)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=300)

    # ---- Retry Config ----
    retry_on_failure: Mapped[bool] = mapped_column(Boolean, default=True)
    max_retries: Mapped[int] = mapped_column(Integer, default=2)
    retry_delay_seconds: Mapped[int] = mapped_column(Integer, default=60)

    # ---- Conditional Execution ----
    condition_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Approval Gate ----
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)

    # ---- Cost Controls ----
    max_cost_per_run_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    monthly_budget_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ---- Metadata ----
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("routine_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    metadata_json: Mapped[dict] = mapped_column(
        "routine_metadata", JSONB, default=dict
    )

    # ---- Computed / Cached ----
    next_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_run_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    total_runs: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_cents: Mapped[int] = mapped_column(Integer, default=0)

    # ---- Timestamps ----
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ---- Relationships ----
    user: Mapped["User"] = relationship("User", back_populates="routines")
    runs: Mapped[list["RoutineRun"]] = relationship(
        "RoutineRun", back_populates="routine", cascade="all, delete-orphan"
    )
    skills: Mapped[list["RoutineSkill"]] = relationship(
        "RoutineSkill", back_populates="routine", cascade="all, delete-orphan"
    )
    webhooks: Mapped[list["RoutineWebhook"]] = relationship(
        "RoutineWebhook", back_populates="routine", cascade="all, delete-orphan"
    )
    source_chains: Mapped[list["RoutineChain"]] = relationship(
        "RoutineChain",
        foreign_keys="RoutineChain.source_routine_id",
        back_populates="source_routine",
        cascade="all, delete-orphan",
    )
    target_chains: Mapped[list["RoutineChain"]] = relationship(
        "RoutineChain",
        foreign_keys="RoutineChain.target_routine_id",
        back_populates="target_routine",
    )

    def __repr__(self) -> str:
        return f"<Routine {self.id} name={self.name}>"


class RoutineSkill(Base):
    """Skills (tools) available to a routine during execution."""

    __tablename__ = "routine_skills"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    routine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("routines.id", ondelete="CASCADE"),
        nullable=False,
    )
    skill_id: Mapped[str] = mapped_column(String(100), nullable=False)

    # Relationships
    routine: Mapped["Routine"] = relationship("Routine", back_populates="skills")

    __table_args__ = (
        UniqueConstraint("routine_id", "skill_id", name="uq_routine_skill"),
    )


class RoutineRun(Base):
    """A single execution of a routine."""

    __tablename__ = "routine_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    routine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("routines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ---- Execution State ----
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    trigger_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="scheduled"
    )

    # ---- Linked Chat Session ----
    chat_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ---- Input Context ----
    resolved_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    input_context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ---- Output ----
    result_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_summary: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ---- Metrics ----
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_cents: Mapped[int] = mapped_column(Integer, default=0)
    tool_calls_count: Mapped[int] = mapped_column(Integer, default=0)
    tool_rounds: Mapped[int] = mapped_column(Integer, default=0)

    # ---- Error Handling ----
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    parent_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("routine_runs.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ---- Condition Check ----
    condition_result: Mapped[str | None] = mapped_column(String(10), nullable=True)
    condition_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Timestamps ----
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ---- Relationships ----
    routine: Mapped["Routine"] = relationship("Routine", back_populates="runs")
    chat_session: Mapped["ChatSession | None"] = relationship("ChatSession")
    artifacts: Mapped[list["RoutineRunArtifact"]] = relationship(
        "RoutineRunArtifact", back_populates="run", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["RoutineNotification"]] = relationship(
        "RoutineNotification", back_populates="run", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<RoutineRun {self.id} status={self.status}>"


class RoutineRunArtifact(Base):
    """An artifact produced during a routine run."""

    __tablename__ = "routine_run_artifacts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("routine_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    artifact_type: Mapped[str] = mapped_column(String(20), nullable=False)
    language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    run: Mapped["RoutineRun"] = relationship("RoutineRun", back_populates="artifacts")

    def __repr__(self) -> str:
        return f"<RoutineRunArtifact {self.id} title={self.title}>"


class RoutineNotification(Base):
    """A persistent notification for a routine run result."""

    __tablename__ = "routine_notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("routine_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ---- Content ----
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    notification_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="result"
    )

    # ---- State ----
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    dismissed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ---- Delivery ----
    sent_channels: Mapped[list] = mapped_column(JSONB, default=list)
    pwa_push_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    webhook_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    webhook_response_code: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ---- Timestamps ----
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ---- Relationships ----
    run: Mapped["RoutineRun"] = relationship(
        "RoutineRun", back_populates="notifications"
    )

    def __repr__(self) -> str:
        return f"<RoutineNotification {self.id} type={self.notification_type}>"


class RoutineChain(Base):
    """A directed edge: source_routine completion triggers target_routine."""

    __tablename__ = "routine_chains"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source_routine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("routines.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_routine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("routines.id", ondelete="CASCADE"),
        nullable=False,
    )

    # ---- Chain Config ----
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    execution_order: Mapped[int] = mapped_column(Integer, default=0)
    trigger_on: Mapped[str] = mapped_column(
        String(20), nullable=False, default="success"
    )
    pass_result: Mapped[bool] = mapped_column(Boolean, default=True)
    context_mapping: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    condition_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ---- Relationships ----
    source_routine: Mapped["Routine"] = relationship(
        "Routine",
        foreign_keys=[source_routine_id],
        back_populates="source_chains",
    )
    target_routine: Mapped["Routine"] = relationship(
        "Routine",
        foreign_keys=[target_routine_id],
        back_populates="target_chains",
    )

    __table_args__ = (
        UniqueConstraint(
            "source_routine_id", "target_routine_id", name="uq_chain_edge"
        ),
        CheckConstraint(
            "source_routine_id != target_routine_id", name="ck_no_self_chain"
        ),
    )

    def __repr__(self) -> str:
        return f"<RoutineChain {self.source_routine_id} -> {self.target_routine_id}>"


class RoutineWebhook(Base):
    """Webhook configuration for a routine."""

    __tablename__ = "routine_webhooks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    routine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("routines.id", ondelete="CASCADE"),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(String(2000), nullable=False)
    method: Mapped[str] = mapped_column(String(10), default="POST")
    headers: Mapped[dict] = mapped_column(JSONB, default=dict)
    payload_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    trigger_on: Mapped[str] = mapped_column(
        String(20), nullable=False, default="success"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    secret: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    routine: Mapped["Routine"] = relationship("Routine", back_populates="webhooks")

    def __repr__(self) -> str:
        return f"<RoutineWebhook {self.id} url={self.url[:50]}>"


class RoutineTemplate(Base):
    """A pre-built routine template."""

    __tablename__ = "routine_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), default="zap")
    prompt_template: Mapped[str] = mapped_column(Text, nullable=False)
    system_prompt_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_cron: Mapped[str] = mapped_column(String(100), nullable=False)
    suggested_skills: Mapped[list] = mapped_column(JSONB, default=list)
    default_model: Mapped[str] = mapped_column(String(50), default="claude-sonnet-4-6")
    default_max_tokens: Mapped[int] = mapped_column(Integer, default=4096)
    variables: Mapped[list] = mapped_column(JSONB, default=list)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<RoutineTemplate {self.id} name={self.name}>"


class PushSubscription(Base):
    """Web Push API subscription for a user's browser/device."""

    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    p256dh_key: Mapped[str] = mapped_column(String(500), nullable=False)
    auth_key: Mapped[str] = mapped_column(String(500), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<PushSubscription {self.id}>"
