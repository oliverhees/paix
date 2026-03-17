"""Add brave_search_api_key to users table.

Revision ID: 010_add_brave_search_key
Revises: 009_structured_persona
Create Date: 2026-03-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "010_add_brave_search_key"
down_revision: Union[str, None] = "009_structured_persona"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("brave_search_api_key", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "brave_search_api_key")
