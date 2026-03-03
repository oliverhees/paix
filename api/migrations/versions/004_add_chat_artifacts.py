"""Add chat_artifacts table for persisting artifacts created during chat.

Revision ID: 004_chat_artifacts
Revises: 003_mcp_skills
Create Date: 2026-03-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision: str = "004_chat_artifacts"
down_revision: Union[str, None] = "003_mcp_skills"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_artifacts",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "session_id",
            UUID(as_uuid=True),
            sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "message_id",
            UUID(as_uuid=True),
            sa.ForeignKey("chat_messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("artifact_type", sa.String(50), nullable=False),
        sa.Column("language", sa.String(50), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("idx_chat_artifacts_session_id", "chat_artifacts", ["session_id"])
    op.create_index("idx_chat_artifacts_message_id", "chat_artifacts", ["message_id"])


def downgrade() -> None:
    op.drop_index("idx_chat_artifacts_message_id", table_name="chat_artifacts")
    op.drop_index("idx_chat_artifacts_session_id", table_name="chat_artifacts")
    op.drop_table("chat_artifacts")
