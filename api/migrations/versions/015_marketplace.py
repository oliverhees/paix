"""Add marketplace_items table for public skill/werkzeug marketplace.

Revision ID: 015_marketplace
Revises: 014_skill_files_table
Create Date: 2026-03-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "015_marketplace"
down_revision: Union[str, None] = "014_skill_files_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "marketplace_items",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("type", sa.String(20), nullable=False),  # "skill" or "werkzeug"
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("icon", sa.String(10), server_default="⚡"),
        sa.Column("author", sa.String(100), server_default="PAI-X Team"),
        sa.Column("version", sa.String(20), server_default="1.0.0"),
        sa.Column("install_count", sa.Integer(), server_default="0"),
        sa.Column("featured", sa.Boolean(), server_default="false"),
        # For skills:
        sa.Column("skill_md", sa.Text()),
        # For werkzeuge:
        sa.Column("address", sa.String(500)),  # npx command or URL
        sa.Column("requirements", sa.JSON()),  # env vars needed
        sa.Column("hint", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_marketplace_items_type", "marketplace_items", ["type"])
    op.create_index("ix_marketplace_items_category", "marketplace_items", ["category"])
    op.create_index("ix_marketplace_items_featured", "marketplace_items", ["featured"])


def downgrade() -> None:
    op.drop_index("ix_marketplace_items_featured", table_name="marketplace_items")
    op.drop_index("ix_marketplace_items_category", table_name="marketplace_items")
    op.drop_index("ix_marketplace_items_type", table_name="marketplace_items")
    op.drop_table("marketplace_items")
