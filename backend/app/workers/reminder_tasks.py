"""
Beat job: every 60s, find reminders due right now, skip ones inside their
own lunch/break window, and push a notification to every active device.

Why UTC storage + local-time comparison: reminder time-of-day fields are
naive (e.g. "09:00") and mean the user's local time, so we convert now() to
the user's timezone before comparing, and only ever compare local wall-clock
values — never mix UTC and local instants directly.

Why synchronous: Celery uses a prefork model. asyncpg connections are bound
to a specific event loop, and asyncio.run() creates a new loop on every
call, so the old connection's Future ends up attached to a different loop →
RuntimeError. Using psycopg2 (sync) avoids this entirely.
"""
import logging
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from app.models import Device, NotificationLog, Reminder, User
from app.services import push_service
from app.services.push_service import GoneException
from app.services.reminder_service import is_due_now
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _in_lunch_period(reminder: Reminder, now_local_time: time) -> bool:
    if not reminder.lunch_start or not reminder.lunch_end:
        return False
    start, end = reminder.lunch_start, reminder.lunch_end
    if start <= end:
        return start <= now_local_time < end
    # Window wraps midnight, e.g. 22:00 - 07:00
    return now_local_time >= start or now_local_time < end


def _check_due_reminders_sync():
    from app.database import SyncSessionLocal

    now_utc = datetime.now(timezone.utc)
    logger.info("[Beat] check_due_reminders — starting at %s", now_utc.isoformat())
    with SyncSessionLocal() as db:
        reminders = db.query(Reminder).filter(Reminder.is_active == True).all()  # noqa: E712
        logger.info("[Beat] check_due_reminders — evaluating %d active reminder(s)", len(reminders))

        for reminder in reminders:
            user = db.query(User).filter(User.id == reminder.user_id).first()
            if not user or not user.reminders_enabled:
                continue

            tz = ZoneInfo(user.timezone or "UTC")
            now_local = now_utc.astimezone(tz)

            if not is_due_now(reminder, now_local):
                continue

            if _in_lunch_period(reminder, now_local.time()):
                logger.info("[Beat] Reminder %s skipped — inside its lunch period", reminder.id)
                continue

            devices = db.query(Device).filter(Device.user_id == user.id, Device.push_enabled == True).all()  # noqa: E712
            if not devices:
                logger.debug("[Beat] Reminder %s has no push-enabled devices — skipping", reminder.id)
                continue

            payload = push_service.build_reminder_payload(str(reminder.id), reminder.title)

            for device in devices:
                try:
                    sent = push_service.send_push(device.push_token, payload)
                    if sent:
                        db.add(NotificationLog(reminder_id=reminder.id, device_id=device.id))
                except GoneException:
                    logger.info("[Push] Removing expired subscription — device %s (reminder %s)", device.id, reminder.id)
                    db.delete(device)
                except Exception as exc:
                    logger.warning("[Push] Push to device %s failed: %s", device.id, exc)

            reminder.last_fired_at = now_utc

        db.commit()
        logger.info("[Beat] check_due_reminders — done")


@celery_app.task(name="app.workers.reminder_tasks.check_due_reminders")
def check_due_reminders():
    _check_due_reminders_sync()
