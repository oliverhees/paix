"""Add api_werkzeuge table for REST API tool registry.

Revision ID: 008_api_werkzeuge
Revises: 007_agent_state
Create Date: 2026-03-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers
revision: str = "008_api_werkzeuge"
down_revision: Union[str, None] = "007_agent_state"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "api_werkzeuge",
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
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=False, server_default=""),
        sa.Column("base_url", sa.String(500), nullable=False),
        sa.Column(
            "auth",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "headers",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "endpoints",
            JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("idx_api_werkzeuge_user_id", "api_werkzeuge", ["user_id"])
    op.create_index("idx_api_werkzeuge_name", "api_werkzeuge", ["user_id", "name"])


def downgrade() -> None:
    op.drop_index("idx_api_werkzeuge_name", table_name="api_werkzeuge")
    op.drop_index("idx_api_werkzeuge_user_id", table_name="api_werkzeuge")
    op.drop_table("api_werkzeuge")
