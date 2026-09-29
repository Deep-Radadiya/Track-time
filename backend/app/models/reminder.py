import enum
import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Index, Integer, String, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RepeatType(str, enum.Enum):
    once = "once"
    hourly = "hourly"
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"


class Reminder(Base):
    __tablename__ = "reminders"
    __table_args__ = (
        Index("ix_reminders_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    repeat_type: Mapped[RepeatType] = mapped_column(Enum(RepeatType, name="repeat_type"), nullable=False)

    time: Mapped[time | None] = mapped_column(Time, nullable=True)
    date: Mapped[date | None] = mapped_column(Date, nullable=True)
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    day_of_month: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Active hours for hourly reminders only: it fires once per hour, but
    # only for hours whose top-of-hour falls in [active_start, active_end).
    active_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    active_end: Mapped[time | None] = mapped_column(Time, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Lunch / break window for THIS reminder: it is not sent while now-local
    # falls in [lunch_start, lunch_end). Unset means no lunch window for it.
    lunch_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    lunch_end: Mapped[time | None] = mapped_column(Time, nullable=True)

    # Last instant this reminder fired a notification, used to guard against
    # sending the same occurrence more than once within its matching window
    # (e.g. an hourly reminder must fire at most once per hour).
    last_fired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="reminders")
