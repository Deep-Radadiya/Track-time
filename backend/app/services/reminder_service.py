"""Core reminder scheduling logic: is a given reminder due right now?

The Celery beat tick runs once a minute, so "due now" means "the target
time-of-day falls within the current minute", guarded by `last_fired_at` so
the same occurrence is never sent twice (e.g. two beat ticks landing in the
same minute, or the beat task running slightly late).

Hourly reminders are anchored to the minute of `active_start` rather than
always firing at :00 — a reminder started at 9:34 fires at 9:34, 10:34,
11:34, etc., for as long as that time-of-day falls within
[active_start, active_end).
"""
from datetime import date, datetime, time
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder, RepeatType


async def get_reminder_for_user(db: AsyncSession, reminder_id: UUID, user_id: UUID) -> Reminder | None:
    result = await db.execute(select(Reminder).where(Reminder.id == reminder_id, Reminder.user_id == user_id))
    return result.scalar_one_or_none()


def _already_fired_in_window(reminder: Reminder, now_local: datetime) -> bool:
    last = reminder.last_fired_at
    if last is None:
        return False
    if reminder.repeat_type == RepeatType.hourly:
        return last.year == now_local.year and last.month == now_local.month and last.day == now_local.day and last.hour == now_local.hour
    if reminder.repeat_type == RepeatType.once:
        return True  # a "once" reminder fires at most one time, ever
    # daily / weekly / monthly: at most once per calendar day
    return last.year == now_local.year and last.month == now_local.month and last.day == now_local.day


def _within_active_hours(reminder: Reminder, now_local_time: time) -> bool:
    if reminder.active_start is None or reminder.active_end is None:
        return True
    start, end = reminder.active_start, reminder.active_end
    if start <= end:
        return start <= now_local_time < end
    # Window wraps midnight, e.g. 22:00 - 07:00
    return now_local_time >= start or now_local_time < end


def is_due_now(reminder: Reminder, now_local: datetime) -> bool:
    if not reminder.is_active:
        return False
    if _already_fired_in_window(reminder, now_local):
        return False

    if reminder.repeat_type == RepeatType.hourly:
        if reminder.active_start is None:
            return False
        # Anchored to active_start's minute, not always :00 — a reminder
        # started at 9:34 fires at 9:34, 10:34, 11:34, ... within the window.
        return now_local.minute == reminder.active_start.minute and _within_active_hours(reminder, now_local.time())

    if reminder.repeat_type == RepeatType.once:
        if reminder.date is None or reminder.time is None:
            return False
        return now_local.date() == reminder.date and now_local.hour == reminder.time.hour and now_local.minute == reminder.time.minute

    if reminder.time is None:
        return False
    time_matches = now_local.hour == reminder.time.hour and now_local.minute == reminder.time.minute

    if reminder.repeat_type == RepeatType.daily:
        return time_matches

    if reminder.repeat_type == RepeatType.weekly:
        return time_matches and reminder.day_of_week is not None and now_local.weekday() == reminder.day_of_week

    if reminder.repeat_type == RepeatType.monthly:
        return time_matches and reminder.day_of_month is not None and now_local.day == reminder.day_of_month

    return False
