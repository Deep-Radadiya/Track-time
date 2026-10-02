"""
Developer-only tooling endpoints.

Only mounted when ENVIRONMENT=development (see main.py).

Endpoints
---------
POST /dev/trigger-checkin         → send a check-in reminder to the authed user now
POST /dev/trigger-reminder-check  → trigger check_due_reminders immediately
GET  /dev/scheduler-status        → show scheduled jobs and next run times
POST /dev/test-push               → send a test push to all of the authed user's devices
"""
import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models import User, Device
from app.services.push_service import send_push, GoneException, build_reminder_payload
from app import scheduler as app_scheduler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/trigger-checkin")
async def trigger_checkin(user: User = Depends(get_current_user)):
    """Send a check-in reminder to the authenticated user right now."""
    from app.jobs.checkin_tasks import send_delayed_checkin_reminder
    await asyncio.to_thread(send_delayed_checkin_reminder, str(user.id))
    logger.info("[Dev] trigger-checkin ran for user %s", user.id)
    return {"status": "done", "user_id": str(user.id), "triggered_at": datetime.now(timezone.utc).isoformat()}


@router.post("/trigger-reminder-check")
async def trigger_reminder_check(user: User = Depends(get_current_user)):
    """Run check_due_reminders immediately (checks ALL users)."""
    from app.jobs.reminder_tasks import check_due_reminders
    await asyncio.to_thread(check_due_reminders)
    logger.info("[Dev] trigger-reminder-check ran by user %s", user.id)
    return {"status": "done", "triggered_at": datetime.now(timezone.utc).isoformat()}


@router.get("/scheduler-status")
async def scheduler_status(user: User = Depends(get_current_user)):
    """Show the scheduled jobs and when each runs next."""
    jobs = {
        job.id: {"next_run_utc": job.next_run_time.isoformat() if job.next_run_time else None, "trigger": str(job.trigger)}
        for job in app_scheduler.scheduler.get_jobs()
    }
    return {
        "running": app_scheduler.scheduler.running,
        "jobs": jobs,
        "server_time_utc": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/test-push")
async def test_push(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send a test push notification to all registered devices of the authenticated user."""
    result = await db.execute(
        select(Device).where(Device.user_id == user.id, Device.push_enabled == True)  # noqa: E712
    )
    devices = result.scalars().all()

    if not devices:
        return {"status": "no_devices", "message": "No push-enabled devices found for this user."}

    payload = {
        "type": "checkin",
        "tag": "dev-test-push",
        "title": "🧪 Test Notification",
        "body": "Push notifications are working correctly!",
        "action_token": "",
    }

    results = []
    for device in devices:
        try:
            send_push(device.push_token, payload)
            results.append({"device_id": str(device.id), "status": "sent"})
            logger.info("[Dev] Test push sent to device %s", device.id)
        except GoneException:
            results.append({"device_id": str(device.id), "status": "gone_expired"})
            db.delete(device)
            logger.info("[Dev] Device %s expired — removed", device.id)
        except Exception as exc:
            results.append({"device_id": str(device.id), "status": "error", "error": str(exc)})
            logger.warning("[Dev] Test push to device %s failed: %s", device.id, exc)

    await db.commit()
    return {
        "status": "done",
        "devices_targeted": len(devices),
        "results": results,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
