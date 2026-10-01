"""Add reminder time window and lunch break to tasks

Revision ID: e5f6a1b2c3d4
Revises: 3a411409b853
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e5f6a1b2c3d4"
down_revision: Union[str, None] = "3a411409b853"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for col in ("window_start", "window_end", "lunch_start", "lunch_end"):
        op.add_column("tasks", sa.Column(col, sa.Time(), nullable=True))


def downgrade() -> None:
    for col in ("lunch_end", "lunch_start", "window_end", "window_start"):
        op.drop_column("tasks", col)
