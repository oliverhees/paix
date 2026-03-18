"""Add completed_at to skill_executions for correct activity feed ordering.

Revision ID: 017_add_completed_at
Revises: 016_add_skill_chain
Create Date: 2026-03-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "017_add_completed_at"
down_revision: Union[str, None] = "016_add_skill_chain"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "skill_executions",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("skill_executions", "completed_at")
