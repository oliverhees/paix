"""Add Telegram bot config columns to users table.

Revision ID: 012_add_user_telegram_config
Revises: 011_add_user_s3_config
Create Date: 2026-03-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "012_add_user_telegram_config"
down_revision: Union[str, None] = "011_add_user_s3_config"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("telegram_bot_token", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("telegram_chat_id", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "telegram_chat_id")
    op.drop_column("users", "telegram_bot_token")
