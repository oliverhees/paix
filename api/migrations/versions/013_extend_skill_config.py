"""Extend skill_configs with category, icon, output_path columns.

Revision ID: 013_extend_skill_config
Revises: 012_add_user_telegram_config
Create Date: 2026-03-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "013_extend_skill_config"
down_revision: Union[str, None] = "012_add_user_telegram_config"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Default categories for seeded skills
_DEFAULT_CATEGORIES = {
    "calendar_briefing": ("productivity", "\U0001f4c5"),   # 📅
    "content_pipeline": ("writing", "\u270d\ufe0f"),       # ✍️
    "meeting_prep": ("productivity", "\U0001f91d"),         # 🤝
    "follow_up": ("communication", "\U0001f4e9"),           # 📩
    "idea_capture": ("creativity", "\U0001f4a1"),           # 💡
}


def upgrade() -> None:
    op.add_column("skill_configs", sa.Column("category", sa.String(50), nullable=True))
    op.add_column("skill_configs", sa.Column("icon", sa.String(10), nullable=True))
    op.add_column("skill_configs", sa.Column("output_path", sa.Text(), nullable=True))

    # Set default categories for seeded skills
    for skill_id, (category, icon) in _DEFAULT_CATEGORIES.items():
        op.execute(
            sa.text(
                "UPDATE skill_configs SET category = :category, icon = :icon "
                "WHERE skill_id = :skill_id"
            ).bindparams(category=category, icon=icon, skill_id=skill_id)
        )


def downgrade() -> None:
    op.drop_column("skill_configs", "output_path")
    op.drop_column("skill_configs", "icon")
    op.drop_column("skill_configs", "category")
