"""Add mcp_servers table and extend skill_configs with Open Standard fields.

Revision ID: 003_mcp_skills
Revises: 002_add_reminders
Create Date: 2026-02-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers
revision: str = "003_mcp_skills"
down_revision: Union[str, None] = "002_add_reminders"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ──────────────────────────────────────────────
    # New table: mcp_servers (Werkzeuge-Registry)
    # ──────────────────────────────────────────────
    op.create_table(
        "mcp_servers",
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
        sa.Column("transport_type", sa.String(50), nullable=False),
        sa.Column(
            "config",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "tools",
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
        sa.CheckConstraint(
            "transport_type IN ('stdio', 'sse', 'streamable_http')",
            name="ck_mcp_servers_transport_type",
        ),
    )
    op.create_index("idx_mcp_servers_user_id", "mcp_servers", ["user_id"])
    op.create_index("idx_mcp_servers_name", "mcp_servers", ["user_id", "name"])

    # ──────────────────────────────────────────────
    # Extend skill_configs: Agent Skills Open Standard fields
    # ──────────────────────────────────────────────
    op.add_column(
        "skill_configs",
        sa.Column("name", sa.String(255), nullable=True),
    )
    op.add_column(
        "skill_configs",
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.add_column(
        "skill_configs",
        sa.Column("system_prompt", sa.Text(), nullable=True),
    )
    op.add_column(
        "skill_configs",
        sa.Column(
            "allowed_tools",
            JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "skill_configs",
        sa.Column(
            "parameters",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "skill_configs",
        sa.Column(
            "is_custom",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "skill_configs",
        sa.Column(
            "skill_metadata",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    # Remove skill_configs columns
    op.drop_column("skill_configs", "skill_metadata")
    op.drop_column("skill_configs", "is_custom")
    op.drop_column("skill_configs", "parameters")
    op.drop_column("skill_configs", "allowed_tools")
    op.drop_column("skill_configs", "system_prompt")
    op.drop_column("skill_configs", "description")
    op.drop_column("skill_configs", "name")

    # Drop mcp_servers table
    op.drop_index("idx_mcp_servers_name", table_name="mcp_servers")
    op.drop_index("idx_mcp_servers_user_id", table_name="mcp_servers")
    op.drop_table("mcp_servers")
