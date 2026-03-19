"""Drop S3 storage config columns from users table — replaced by local storage.

Revision ID: 018_drop_user_s3_columns
Revises: 017_add_completed_at
Create Date: 2026-03-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "018_drop_user_s3_columns"
down_revision: Union[str, None] = "017_add_completed_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("users", "s3_endpoint_url")
    op.drop_column("users", "s3_access_key")
    op.drop_column("users", "s3_secret_key")
    op.drop_column("users", "s3_bucket_name")
    op.drop_column("users", "s3_region")


def downgrade() -> None:
    op.add_column("users", sa.Column("s3_region", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("s3_bucket_name", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("s3_secret_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("s3_access_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("s3_endpoint_url", sa.Text(), nullable=True))
