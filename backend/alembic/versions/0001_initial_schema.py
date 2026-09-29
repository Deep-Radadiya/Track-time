"""initial schema (simplified reminder MVP)

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-09-29 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="UTC"),
        sa.Column("primary_device_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reminders_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("push_token", sa.String(2000), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("push_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_devices_user_id", "devices", ["user_id"])

    op.create_foreign_key(
        "fk_user_primary_device", "users", "devices", ["primary_device_id"], ["id"], ondelete="SET NULL"
    )

    repeat_type = postgresql.ENUM("once", "hourly", "daily", "weekly", "monthly", name="repeat_type", create_type=False)
    repeat_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "reminders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("repeat_type", repeat_type, nullable=False),
        sa.Column("time", sa.Time(), nullable=True),
        sa.Column("date", sa.Date(), nullable=True),
        sa.Column("day_of_week", sa.Integer(), nullable=True),
        sa.Column("day_of_month", sa.Integer(), nullable=True),
        sa.Column("active_start", sa.Time(), nullable=True),
        sa.Column("active_end", sa.Time(), nullable=True),
        sa.Column("lunch_start", sa.Time(), nullable=True),
        sa.Column("lunch_end", sa.Time(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_fired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_reminders_user_id", "reminders", ["user_id"])

    op.create_table(
        "notifications_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("reminder_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("reminders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("devices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("channel", sa.String(50), nullable=False, server_default="push"),
    )
    op.create_index("ix_notifications_log_reminder_id", "notifications_log", ["reminder_id"])


def downgrade() -> None:
    op.drop_table("notifications_log")
    op.drop_table("reminders")
    op.execute("DROP TYPE IF EXISTS repeat_type")
    op.drop_constraint("fk_user_primary_device", "users", type_="foreignkey")
    op.drop_table("devices")
    op.drop_table("users")
