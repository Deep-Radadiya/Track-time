"""Shapes of the data sent to and from the /tasks routes."""
from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.models.task import TaskStatus, Recurrence, TaskSource


class TaskNoteIn(BaseModel):
    text: str
    done: bool = False
    order_index: int = 0


class TaskNoteOut(TaskNoteIn):
    id: UUID
    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    title: str
    recurrence: Recurrence = Recurrence.none
    due_at: datetime | None = None
    interval_minutes: int | None = None
    category: str | None = None
    source: TaskSource = TaskSource.text
    notes: list[TaskNoteIn] = []
    window_start: time | None = None
    window_end: time | None = None
    lunch_start: time | None = None
    lunch_end: time | None = None

    @model_validator(mode="after")
    def _check_window(self):
        if (self.window_start is None) != (self.window_end is None):
            raise ValueError("window_start and window_end must be set together")
        if self.window_start is not None:
            if self.window_end <= self.window_start:
                raise ValueError("End time must be after start time")
            if not self.interval_minutes or self.interval_minutes <= 0:
                raise ValueError("interval_minutes is required with a time window")
        if (self.lunch_start is None) != (self.lunch_end is None):
            raise ValueError("lunch_start and lunch_end must be set together")
        if self.lunch_start is not None and self.lunch_end <= self.lunch_start:
            raise ValueError("Lunch end must be after lunch start")
        return self


class TaskUpdate(BaseModel):
    title: str | None = None
    status: TaskStatus | None = None
    recurrence: Recurrence | None = None
    due_at: datetime | None = None
    interval_minutes: int | None = None
    category: str | None = None


class TaskOut(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    status: TaskStatus
    recurrence: Recurrence
    due_at: datetime | None
    anchor_time: datetime | None
    interval_minutes: int | None
    next_due_at: datetime | None
    snoozed_until: datetime | None
    snoozed_count_today: int
    snoozed_count_total: int
    category: str | None
    window_start: time | None = None
    window_end: time | None = None
    lunch_start: time | None = None
    lunch_end: time | None = None
    source: TaskSource
    created_at: datetime
    updated_at: datetime
    notes: list[TaskNoteOut] = []

    model_config = {"from_attributes": True}


class TaskActionRequest(BaseModel):
    action: str = Field(description="One of: done, snooze, start, block, reopen")
    client_timestamp: datetime
    snooze_minutes: int | None = Field(default=None, description="Required when action == snooze")
