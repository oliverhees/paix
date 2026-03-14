"""Add structured persona fields to users table.

Revision ID: 009_structured_persona
Revises: 008_api_werkzeuge
Create Date: 2026-03-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "009_structured_persona"
down_revision: Union[str, None] = "008_api_werkzeuge"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("persona_personality", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("persona_about_user", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("persona_communication", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "persona_communication")
    op.drop_column("users", "persona_about_user")
    op.drop_column("users", "persona_personality")
