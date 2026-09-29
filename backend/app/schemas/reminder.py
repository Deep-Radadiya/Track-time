import datetime as dt
from uuid import UUID

from pydantic import BaseModel, model_validator

from app.models.reminder import RepeatType

_REQUIRED_FIELDS: dict[RepeatType, tuple[str, ...]] = {
    RepeatType.once: ("date", "time"),
    RepeatType.hourly: ("active_start", "active_end"),
    RepeatType.daily: ("time",),
    RepeatType.weekly: ("day_of_week", "time"),
    RepeatType.monthly: ("day_of_month", "time"),
}


class ReminderBase(BaseModel):
    title: str
    repeat_type: RepeatType
    time: dt.time | None = None
    date: dt.date | None = None
    day_of_week: int | None = None
    day_of_month: int | None = None
    active_start: dt.time | None = None
    active_end: dt.time | None = None
    lunch_start: dt.time | None = None
    lunch_end: dt.time | None = None

    @model_validator(mode="after")
    def _check_required_fields(self):
        for field in _REQUIRED_FIELDS[self.repeat_type]:
            if getattr(self, field) is None:
                raise ValueError(f"{field} is required for repeat_type={self.repeat_type.value}")
        if self.day_of_week is not None and not (0 <= self.day_of_week <= 6):
            raise ValueError("day_of_week must be between 0 (Monday) and 6 (Sunday)")
        if self.day_of_month is not None and not (1 <= self.day_of_month <= 31):
            raise ValueError("day_of_month must be between 1 and 31")
        if (self.lunch_start is None) != (self.lunch_end is None):
            raise ValueError("lunch_start and lunch_end must both be set or both be empty")
        if (self.active_start is None) != (self.active_end is None):
            raise ValueError("active_start and active_end must both be set or both be empty")
        return self


class ReminderCreate(ReminderBase):
    pass


class ReminderUpdate(ReminderBase):
    is_active: bool | None = None


class ReminderOut(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    repeat_type: RepeatType
    time: dt.time | None
    date: dt.date | None
    day_of_week: int | None
    day_of_month: int | None
    active_start: dt.time | None
    active_end: dt.time | None
    lunch_start: dt.time | None
    lunch_end: dt.time | None
    is_active: bool
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}
