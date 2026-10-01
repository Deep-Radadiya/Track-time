from datetime import datetime, time, timezone

from app.services.task_service import next_window_slot

TZ = "Asia/Kolkata"  # UTC+5:30


def _utc(h, m=0, day=1):
    return datetime(2026, 10, day, h, m, tzinfo=timezone.utc)


def _local(dt):
    from zoneinfo import ZoneInfo
    return dt.astimezone(ZoneInfo(TZ)).strftime("%d %H:%M")


def slot(after, **kw):
    args = dict(window_start=time(9, 15), window_end=time(18, 0), interval_minutes=30,
                lunch_start=time(13, 0), lunch_end=time(14, 0))
    args.update(kw)
    return next_window_slot(after, TZ, **args)


def test_before_window_returns_window_start():
    # 02:00 UTC = 07:30 IST
    assert _local(slot(_utc(2))) == "01 09:15"


def test_next_slot_inside_window():
    # 04:00 UTC = 09:30 IST -> next is 09:45
    assert _local(slot(_utc(4))) == "01 09:45"


def test_lunch_is_skipped():
    # 07:20 UTC = 12:50 IST -> 13:15 is lunch, next is 14:15
    got = slot(_utc(7, 20), window_start=time(9, 0))
    assert _local(got) == "01 14:00"


def test_after_window_rolls_to_next_day():
    # 13:00 UTC = 18:30 IST
    assert _local(slot(_utc(13))) == "02 09:15"


def test_no_lunch():
    got = slot(_utc(7, 20), window_start=time(9, 0), lunch_start=None, lunch_end=None)
    assert _local(got) == "01 13:00"
