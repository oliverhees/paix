"""Add agent_state table for persistent per-user agent memory.

Revision ID: 007_agent_state
Revises: 006
Create Date: 2026-03-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision: str = "007_agent_state"
down_revision: Union[str, None] = "006_persona"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_state",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("scope", sa.String(50), nullable=False, server_default="global"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
    )
    # Unique index on (user_id, key) — one value per key per user
    op.create_index(
        "ix_agent_state_user_key",
        "agent_state",
        ["user_id", "key"],
        unique=True,
    )
    # Non-unique index on user_id for fast per-user listing
    op.create_index(
        "ix_agent_state_user_id",
        "agent_state",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_agent_state_user_id", table_name="agent_state")
    op.drop_index("ix_agent_state_user_key", table_name="agent_state")
    op.drop_table("agent_state")
