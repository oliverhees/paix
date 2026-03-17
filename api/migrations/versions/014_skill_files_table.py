"""Add skill_files table for storing skill files in PostgreSQL.

Revision ID: 014_skill_files_table
Revises: 013_extend_skill_config
Create Date: 2026-03-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "014_skill_files_table"
down_revision: Union[str, None] = "013_extend_skill_config"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "skill_files",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("skill_id", sa.String(100), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(100), server_default="text/markdown"),
        sa.Column("file_type", sa.String(50), server_default="reference"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_skill_files_user_skill", "skill_files", ["user_id", "skill_id"])


def downgrade() -> None:
    op.drop_index("ix_skill_files_user_skill", table_name="skill_files")
    op.drop_table("skill_files")
