"""Add S3 storage config columns to users table.

Revision ID: 011_add_user_s3_config
Revises: 010_add_brave_search_key
Create Date: 2026-03-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "011_add_user_s3_config"
down_revision: Union[str, None] = "010_add_brave_search_key"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("s3_endpoint_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("s3_access_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("s3_secret_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("s3_bucket_name", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("s3_region", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "s3_region")
    op.drop_column("users", "s3_bucket_name")
    op.drop_column("users", "s3_secret_key")
    op.drop_column("users", "s3_access_key")
    op.drop_column("users", "s3_endpoint_url")
