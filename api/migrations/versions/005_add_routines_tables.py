"""Add routines system tables.

Revision ID: 005_routines
Revises: 004_chat_artifacts
Create Date: 2026-03-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers
revision: str = "005_routines"
down_revision: Union[str, None] = "004_chat_artifacts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── routine_templates (must exist before routines FK) ──
    op.create_table(
        "routine_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("icon", sa.String(50), server_default="zap"),
        sa.Column("prompt_template", sa.Text(), nullable=False),
        sa.Column("system_prompt_override", sa.Text(), nullable=True),
        sa.Column("suggested_cron", sa.String(100), nullable=False),
        sa.Column("suggested_skills", JSONB, server_default="[]"),
        sa.Column("default_model", sa.String(50), server_default="claude-sonnet-4-6"),
        sa.Column("default_max_tokens", sa.Integer(), server_default="4096"),
        sa.Column("variables", JSONB, server_default="[]"),
        sa.Column("is_featured", sa.Boolean(), server_default="false"),
        sa.Column("usage_count", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    # ── routines ──
    op.create_table(
        "routines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # Definition
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("system_prompt_override", sa.Text(), nullable=True),
        # Schedule
        sa.Column("cron_expression", sa.String(100), nullable=False),
        sa.Column("timezone", sa.String(50), server_default="Europe/Berlin"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        # Execution Config
        sa.Column("max_tokens", sa.Integer(), server_default="8192"),
        sa.Column("model", sa.String(50), server_default="claude-sonnet-4-6"),
        sa.Column("temperature", sa.Float(), server_default="0.7"),
        sa.Column("max_tool_rounds", sa.Integer(), server_default="3"),
        sa.Column("timeout_seconds", sa.Integer(), server_default="300"),
        # Retry Config
        sa.Column("retry_on_failure", sa.Boolean(), server_default="true"),
        sa.Column("max_retries", sa.Integer(), server_default="2"),
        sa.Column("retry_delay_seconds", sa.Integer(), server_default="60"),
        # Conditional Execution
        sa.Column("condition_prompt", sa.Text(), nullable=True),
        # Approval Gate
        sa.Column("requires_approval", sa.Boolean(), server_default="false"),
        # Cost Controls
        sa.Column("max_cost_per_run_cents", sa.Integer(), nullable=True),
        sa.Column("monthly_budget_cents", sa.Integer(), nullable=True),
        # Metadata
        sa.Column("template_id", UUID(as_uuid=True), sa.ForeignKey("routine_templates.id", ondelete="SET NULL"), nullable=True),
        sa.Column("tags", JSONB, server_default="[]"),
        sa.Column("routine_metadata", JSONB, server_default="{}"),
        # Computed / Cached
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_status", sa.String(20), nullable=True),
        sa.Column("total_runs", sa.Integer(), server_default="0"),
        sa.Column("total_cost_cents", sa.Integer(), server_default="0"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_routines_user_id", "routines", ["user_id"])
    op.create_index("idx_routines_active", "routines", ["user_id", "is_active"])
    op.create_index("idx_routines_next_run", "routines", ["next_run_at"])

    # ── routine_skills ──
    op.create_table(
        "routine_skills",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("routine_id", UUID(as_uuid=True), sa.ForeignKey("routines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("skill_id", sa.String(100), nullable=False),
        sa.UniqueConstraint("routine_id", "skill_id", name="uq_routine_skill"),
    )

    # ── routine_runs ──
    op.create_table(
        "routine_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("routine_id", UUID(as_uuid=True), sa.ForeignKey("routines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # Execution State
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("trigger_type", sa.String(20), nullable=False, server_default="scheduled"),
        # Linked Chat Session
        sa.Column("chat_session_id", UUID(as_uuid=True), sa.ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True),
        # Input Context
        sa.Column("resolved_prompt", sa.Text(), nullable=False),
        sa.Column("input_context", JSONB, nullable=True),
        # Output
        sa.Column("result_text", sa.Text(), nullable=True),
        sa.Column("result_summary", sa.String(500), nullable=True),
        # Metrics
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), server_default="0"),
        sa.Column("output_tokens", sa.Integer(), server_default="0"),
        sa.Column("total_tokens", sa.Integer(), server_default="0"),
        sa.Column("estimated_cost_cents", sa.Integer(), server_default="0"),
        sa.Column("tool_calls_count", sa.Integer(), server_default="0"),
        sa.Column("tool_rounds", sa.Integer(), server_default="0"),
        # Error Handling
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("error_type", sa.String(100), nullable=True),
        sa.Column("retry_count", sa.Integer(), server_default="0"),
        sa.Column("parent_run_id", UUID(as_uuid=True), sa.ForeignKey("routine_runs.id", ondelete="SET NULL"), nullable=True),
        # Condition Check
        sa.Column("condition_result", sa.String(10), nullable=True),
        sa.Column("condition_reason", sa.Text(), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_routine_runs_routine", "routine_runs", ["routine_id"])
    op.create_index("idx_routine_runs_user", "routine_runs", ["user_id"])
    op.create_index("idx_routine_runs_status", "routine_runs", ["status"])
    op.create_index("idx_routine_runs_created", "routine_runs", ["created_at"])

    # ── routine_run_artifacts ──
    op.create_table(
        "routine_run_artifacts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("routine_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("artifact_type", sa.String(20), nullable=False),
        sa.Column("language", sa.String(50), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_routine_run_artifacts_run", "routine_run_artifacts", ["run_id"])

    # ── routine_notifications ──
    op.create_table(
        "routine_notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("routine_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # Content
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("summary", sa.String(500), nullable=False),
        sa.Column("notification_type", sa.String(30), nullable=False, server_default="result"),
        # State
        sa.Column("is_pinned", sa.Boolean(), server_default="true"),
        sa.Column("is_read", sa.Boolean(), server_default="false"),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
        # Delivery
        sa.Column("sent_channels", JSONB, server_default="[]"),
        sa.Column("pwa_push_sent", sa.Boolean(), server_default="false"),
        sa.Column("webhook_sent", sa.Boolean(), server_default="false"),
        sa.Column("webhook_response_code", sa.Integer(), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_routine_notif_user", "routine_notifications", ["user_id"])
    op.create_index("idx_routine_notif_run", "routine_notifications", ["run_id"])

    # ── routine_chains ──
    op.create_table(
        "routine_chains",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("source_routine_id", UUID(as_uuid=True), sa.ForeignKey("routines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_routine_id", UUID(as_uuid=True), sa.ForeignKey("routines.id", ondelete="CASCADE"), nullable=False),
        # Chain Config
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("execution_order", sa.Integer(), server_default="0"),
        sa.Column("trigger_on", sa.String(20), nullable=False, server_default="success"),
        sa.Column("pass_result", sa.Boolean(), server_default="true"),
        sa.Column("context_mapping", JSONB, nullable=True),
        sa.Column("condition_prompt", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        # Constraints
        sa.UniqueConstraint("source_routine_id", "target_routine_id", name="uq_chain_edge"),
        sa.CheckConstraint("source_routine_id != target_routine_id", name="ck_no_self_chain"),
    )
    op.create_index("idx_chains_source", "routine_chains", ["source_routine_id"])
    op.create_index("idx_chains_target", "routine_chains", ["target_routine_id"])

    # ── routine_webhooks ──
    op.create_table(
        "routine_webhooks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("routine_id", UUID(as_uuid=True), sa.ForeignKey("routines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(2000), nullable=False),
        sa.Column("method", sa.String(10), server_default="POST"),
        sa.Column("headers", JSONB, server_default="{}"),
        sa.Column("payload_template", sa.Text(), nullable=True),
        sa.Column("trigger_on", sa.String(20), nullable=False, server_default="success"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("secret", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    # ── push_subscriptions ──
    op.create_table(
        "push_subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("p256dh_key", sa.String(500), nullable=False),
        sa.Column("auth_key", sa.String(500), nullable=False),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_push_sub_user", "push_subscriptions", ["user_id"])


def downgrade() -> None:
    op.drop_table("push_subscriptions")
    op.drop_table("routine_webhooks")
    op.drop_index("idx_chains_target", table_name="routine_chains")
    op.drop_index("idx_chains_source", table_name="routine_chains")
    op.drop_table("routine_chains")
    op.drop_index("idx_routine_notif_run", table_name="routine_notifications")
    op.drop_index("idx_routine_notif_user", table_name="routine_notifications")
    op.drop_table("routine_notifications")
    op.drop_index("idx_routine_run_artifacts_run", table_name="routine_run_artifacts")
    op.drop_table("routine_run_artifacts")
    op.drop_index("idx_routine_runs_created", table_name="routine_runs")
    op.drop_index("idx_routine_runs_status", table_name="routine_runs")
    op.drop_index("idx_routine_runs_user", table_name="routine_runs")
    op.drop_index("idx_routine_runs_routine", table_name="routine_runs")
    op.drop_table("routine_runs")
    op.drop_table("routine_skills")
    op.drop_index("idx_routines_next_run", table_name="routines")
    op.drop_index("idx_routines_active", table_name="routines")
    op.drop_index("idx_routines_user_id", table_name="routines")
    op.drop_table("routines")
    op.drop_table("routine_templates")
