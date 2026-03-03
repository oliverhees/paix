"""Initial database schema — all PostgreSQL tables from SCHEMA.md.

Revision ID: 001_initial
Revises: None
Create Date: 2026-02-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET

# revision identifiers
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ──────────────────────────────────────────────
    # users
    # ──────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("timezone", sa.String(50), server_default="Europe/Berlin"),
        sa.Column("language", sa.String(10), server_default="de"),
        sa.Column("oauth_provider", sa.String(50), nullable=True),
        sa.Column("oauth_provider_id", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_users_email", "users", ["email"])

    # ──────────────────────────────────────────────
    # sessions (auth sessions / refresh tokens)
    # ──────────────────────────────────────────────
    op.create_table(
        "sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("refresh_token", sa.String(500), unique=True, nullable=False),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("ip_address", INET, nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_sessions_user_id", "sessions", ["user_id"])
    op.create_index("idx_sessions_expires_at", "sessions", ["expires_at"])

    # ──────────────────────────────────────────────
    # chat_sessions
    # ──────────────────────────────────────────────
    op.create_table(
        "chat_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message_count", sa.Integer(), server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_chat_sessions_user_id", "chat_sessions", ["user_id"])

    # ──────────────────────────────────────────────
    # chat_messages
    # ──────────────────────────────────────────────
    op.create_table(
        "chat_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("skill_used", sa.String(100), nullable=True),
        sa.Column("sources", JSONB, nullable=True),
        sa.Column("feedback_rating", sa.String(20), nullable=True),
        sa.Column("feedback_comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_chat_messages_session_id", "chat_messages", ["session_id"])
    op.create_index("idx_chat_messages_created_at", "chat_messages", ["created_at"])

    # ──────────────────────────────────────────────
    # skill_configs
    # ──────────────────────────────────────────────
    op.create_table(
        "skill_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("skill_id", sa.String(100), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("autonomy_level", sa.Integer(), server_default=sa.text("3")),
        sa.Column("config", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("user_id", "skill_id", name="uq_skill_configs_user_skill"),
        sa.CheckConstraint("autonomy_level BETWEEN 1 AND 5", name="ck_autonomy_level_range"),
    )

    # ──────────────────────────────────────────────
    # skill_executions
    # ──────────────────────────────────────────────
    op.create_table(
        "skill_executions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("skill_id", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("input_summary", sa.Text(), nullable=True),
        sa.Column("output_summary", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metadata", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_skill_executions_user_skill", "skill_executions", ["user_id", "skill_id"])
    op.create_index("idx_skill_executions_created_at", "skill_executions", ["created_at"])

    # ──────────────────────────────────────────────
    # notification_settings
    # ──────────────────────────────────────────────
    op.create_table(
        "notification_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("daily_briefing_enabled", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("daily_briefing_time", sa.Time(), server_default=sa.text("'07:30'")),
        sa.Column("pre_meeting_enabled", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("pre_meeting_minutes", sa.Integer(), server_default=sa.text("60")),
        sa.Column("follow_up_enabled", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("follow_up_hours", sa.Integer(), server_default=sa.text("48")),
        sa.Column("deadline_warning_enabled", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("deadline_warning_hours", sa.Integer(), server_default=sa.text("72")),
        sa.Column("idea_synthesis_enabled", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("idea_synthesis_day", sa.String(10), server_default="sunday"),
        sa.Column("idea_synthesis_time", sa.Time(), server_default=sa.text("'10:00'")),
        sa.Column("channels", JSONB, server_default=sa.text("'{\"telegram\": true, \"pwa_push\": true, \"email\": false}'::jsonb")),
        sa.Column("telegram_chat_id", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    # ──────────────────────────────────────────────
    # notifications
    # ──────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("action_url", sa.String(500), nullable=True),
        sa.Column("read", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("sent_channels", JSONB, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_notifications_user_unread", "notifications", ["user_id", "read"])
    op.create_index("idx_notifications_created_at", "notifications", ["created_at"])

    # ──────────────────────────────────────────────
    # integration_tokens
    # ──────────────────────────────────────────────
    op.create_table(
        "integration_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("scopes", sa.String(500), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("user_id", "provider", name="uq_integration_tokens_user_provider"),
    )

    # ──────────────────────────────────────────────
    # telos_snapshots (PostgreSQL cache of TELOS state)
    # ──────────────────────────────────────────────
    op.create_table(
        "telos_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dimension", sa.String(50), nullable=False),
        sa.Column("content_json", JSONB, nullable=False),
        sa.Column("version", sa.Integer(), server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_telos_snapshots_user_dimension", "telos_snapshots", ["user_id", "dimension"])

    # ──────────────────────────────────────────────
    # documents (reference to generated/uploaded documents)
    # ──────────────────────────────────────────────
    op.create_table(
        "documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("drive_url", sa.String(500), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_documents_user_id", "documents", ["user_id"])

    # ──────────────────────────────────────────────
    # audit_log
    # ──────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.String(100), nullable=True),
        sa.Column("details_json", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("idx_audit_log_created_at", "audit_log", ["created_at"])
    op.create_index("idx_audit_log_action", "audit_log", ["action"])

    # ──────────────────────────────────────────────
    # proactive_triggers
    # ──────────────────────────────────────────────
    op.create_table(
        "proactive_triggers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trigger_type", sa.String(50), nullable=False),
        sa.Column("cron_expression", sa.String(100), nullable=True),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("config_json", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    op.create_index("idx_proactive_triggers_user_id", "proactive_triggers", ["user_id"])


def downgrade() -> None:
    """Drop all tables in reverse order."""
    op.drop_table("proactive_triggers")
    op.drop_table("audit_log")
    op.drop_table("documents")
    op.drop_table("telos_snapshots")
    op.drop_table("integration_tokens")
    op.drop_table("notifications")
    op.drop_table("notification_settings")
    op.drop_table("skill_executions")
    op.drop_table("skill_configs")
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    op.drop_table("sessions")
    op.drop_table("users")
