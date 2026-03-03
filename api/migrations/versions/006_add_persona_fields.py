"""Add persona customization fields to users.

Revision ID: 006
Revises: 005
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("persona_name", sa.String(100), server_default="PAI-X", nullable=False))
    op.add_column("users", sa.Column("persona_prompt", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "persona_prompt")
    op.drop_column("users", "persona_name")
