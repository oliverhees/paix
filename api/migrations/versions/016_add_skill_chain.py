"""Add next_skill_id to skill_configs for skill chaining.

Revision ID: 016_add_skill_chain
Revises: 015_marketplace
Create Date: 2026-03-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "016_add_skill_chain"
down_revision: Union[str, None] = "015_marketplace"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "skill_configs",
        sa.Column("next_skill_id", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("skill_configs", "next_skill_id")
