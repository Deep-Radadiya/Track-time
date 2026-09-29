"""
Unit tests for reminder scheduling math (app/services/reminder_service.py)
and the lunch-period guard (app/workers/reminder_tasks.py). Pure in-memory
objects, no DB/network needed.
"""
from datetime import date, datetime, time
from uuid import uuid4

from app.models.reminder import Reminder, RepeatType
from app.services import reminder_service
from app.workers.reminder_tasks import _in_lunch_period


def make_reminder(**overrides) -> Reminder:
    defaults = dict(
        id=uuid4(),
        user_id=uuid4(),
        title="Test reminder",
        repeat_type=RepeatType.daily,
        time=None,
        date=None,
        day_of_week=None,
        day_of_month=None,
        active_start=None,
        active_end=None,
        lunch_start=None,
        lunch_end=None,
        is_active=True,
        last_fired_at=None,
    )
    defaults.update(overrides)
    return Reminder(**defaults)


def test_hourly_fires_on_active_start_minute_each_hour():
    r = make_reminder(repeat_type=RepeatType.hourly, active_start=time(9, 34), active_end=time(18, 34))
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 9, 34)) is True
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 10, 34)) is True
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 10, 0)) is False
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 10, 30)) is False


def test_hourly_does_not_double_fire_within_same_hour():
    r = make_reminder(repeat_type=RepeatType.hourly, active_start=time(9, 0), active_end=time(18, 0), last_fired_at=datetime(2026, 1, 1, 9, 0))
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 9, 0)) is False


def test_hourly_fires_again_next_hour():
    r = make_reminder(repeat_type=RepeatType.hourly, active_start=time(9, 0), active_end=time(18, 0), last_fired_at=datetime(2026, 1, 1, 9, 0))
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 10, 0)) is True


def test_once_fires_on_exact_date_and_time():
    r = make_reminder(repeat_type=RepeatType.once, date=date(2026, 3, 5), time=time(14, 30))
    assert reminder_service.is_due_now(r, datetime(2026, 3, 5, 14, 30)) is True
    assert reminder_service.is_due_now(r, datetime(2026, 3, 5, 14, 31)) is False
    assert reminder_service.is_due_now(r, datetime(2026, 3, 6, 14, 30)) is False


def test_once_never_fires_twice():
    r = make_reminder(
        repeat_type=RepeatType.once,
        date=date(2026, 3, 5),
        time=time(14, 30),
        last_fired_at=datetime(2026, 3, 5, 14, 30),
    )
    assert reminder_service.is_due_now(r, datetime(2026, 3, 5, 14, 30)) is False


def test_daily_fires_at_configured_time_once_per_day():
    r = make_reminder(repeat_type=RepeatType.daily, time=time(9, 0))
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 9, 0)) is True
    r.last_fired_at = datetime(2026, 1, 1, 9, 0)
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 9, 0)) is False
    assert reminder_service.is_due_now(r, datetime(2026, 1, 2, 9, 0)) is True


def test_weekly_fires_only_on_configured_weekday():
    r = make_reminder(repeat_type=RepeatType.weekly, day_of_week=0, time=time(10, 0))  # Monday
    monday = datetime(2026, 1, 5, 10, 0)  # a Monday
    tuesday = datetime(2026, 1, 6, 10, 0)
    assert monday.weekday() == 0
    assert reminder_service.is_due_now(r, monday) is True
    assert reminder_service.is_due_now(r, tuesday) is False


def test_monthly_fires_only_on_configured_day_of_month():
    r = make_reminder(repeat_type=RepeatType.monthly, day_of_month=15, time=time(8, 0))
    assert reminder_service.is_due_now(r, datetime(2026, 2, 15, 8, 0)) is True
    assert reminder_service.is_due_now(r, datetime(2026, 2, 16, 8, 0)) is False


def test_inactive_reminder_never_due():
    r = make_reminder(repeat_type=RepeatType.hourly, active_start=time(9, 0), active_end=time(18, 0), is_active=False)
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 9, 0)) is False


def test_hourly_only_fires_within_active_hours_window():
    r = make_reminder(repeat_type=RepeatType.hourly, active_start=time(9, 0), active_end=time(18, 0))
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 9, 0)) is True
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 17, 0)) is True
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 18, 0)) is False
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 8, 0)) is False


def test_hourly_without_active_start_never_due():
    r = make_reminder(repeat_type=RepeatType.hourly, active_start=None, active_end=None)
    assert reminder_service.is_due_now(r, datetime(2026, 1, 1, 3, 0)) is False


def test_lunch_period_blocks_reminder_inside_window():
    r = make_reminder(lunch_start=time(13, 0), lunch_end=time(14, 0))
    assert _in_lunch_period(r, time(13, 30)) is True


def test_lunch_period_allows_reminder_outside_window():
    r = make_reminder(lunch_start=time(13, 0), lunch_end=time(14, 0))
    assert _in_lunch_period(r, time(14, 30)) is False


def test_no_lunch_period_configured_never_blocks():
    r = make_reminder(lunch_start=None, lunch_end=None)
    assert _in_lunch_period(r, time(13, 30)) is False
