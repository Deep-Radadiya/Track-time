"""
In-process scheduler. Runs inside the API process, so there is no separate
worker/beat/Redis to run. Jobs:
  - check_due_reminders: every minute, send push for due reminders
  - run_hourly_checkins: every minute, send check-in pushes
  - run_day_end_summaries: top of every hour (filters to users at 9pm local)
"""
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="UTC")


def _safe(fn):
    def run():
        try:
            fn()
        except Exception:
            logger.exception("[Scheduler] job %s failed", fn.__name__)
    run.__name__ = fn.__name__
    return run


def start() -> None:
    from app.jobs.checkin_tasks import run_hourly_checkins
    from app.jobs.reminder_tasks import check_due_reminders
    from app.jobs.summary_tasks import run_day_end_summaries

    if scheduler.running:
        return
    # max_instances=1 + coalesce: never overlap or pile up if a run is slow.
    opts = dict(max_instances=1, coalesce=True, misfire_grace_time=30)
    scheduler.add_job(_safe(check_due_reminders), "interval", seconds=60, id="check_due_reminders", **opts)
    scheduler.add_job(_safe(run_hourly_checkins), "interval", seconds=60, id="run_hourly_checkins", **opts)
    scheduler.add_job(_safe(run_day_end_summaries), "cron", minute=0, id="run_day_end_summaries", **opts)
    scheduler.start()
    logger.info("[Scheduler] started with %d jobs", len(scheduler.get_jobs()))


def stop() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


def schedule_delayed_checkin(user_id: str, minutes: int = 10) -> None:
    """Send a check-in reminder to one user after `minutes` (the 'remind me later' button)."""
    from app.jobs.checkin_tasks import send_delayed_checkin_reminder

    scheduler.add_job(
        _safe(lambda: send_delayed_checkin_reminder(user_id)),
        "date",
        run_date=datetime.now(timezone.utc) + timedelta(minutes=minutes),
    )
