"""
Day-end summary job.

After generating the AI summary for a user:
1. Sends a Web Push notification to every push-enabled device with the full
   summary embedded in the payload (so the OS notification body is meaningful).
2. Sends the summary to any open WebSocket connections in real time, without
   the user having to tap the notification.
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import asyncio
import json
import logging

from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.models import User, Task, TaskStatus, TaskSource, Device
from app.models.companion import DailySummary
from app.services import push_service, summary_service

logger = logging.getLogger(__name__)


def _task_stats(tasks: list) -> dict:
    completed = [t for t in tasks if t.status == TaskStatus.done]
    open_tasks = [t for t in tasks if t.status != TaskStatus.done]
    total_snoozes = sum(t.snoozed_count_today for t in tasks)
    voice_count = sum(1 for t in tasks if t.source == TaskSource.voice)
    text_count = sum(1 for t in tasks if t.source == TaskSource.text)
    return {
        "completed_count": len(completed),
        "still_open_count": len(open_tasks),
        "still_open_titles": [t.title for t in open_tasks][:10],
        "snooze_count": total_snoozes,
        "voice_created": voice_count,
        "text_created": text_count,
    }


# Async version — used by the FastAPI /summary/trigger endpoint
async def build_daily_stats(db: AsyncSession, user_id) -> dict:
    result = await db.execute(select(Task).where(Task.user_id == user_id))
    tasks = list(result.scalars().all())
    return _task_stats(tasks)


# Sync version — used by the scheduler job
def build_daily_stats_sync(db: Session, user_id) -> dict:
    tasks = db.query(Task).filter(Task.user_id == user_id).all()
    return _task_stats(tasks)


def _publish_ws_summary(user_id: str, result: dict) -> None:
    """Push the summary to the user's open browser tabs (same process as the API)."""
    try:
        from uuid import UUID
        from app.websocket.connection_manager import manager

        manager.broadcast_from_thread(UUID(user_id), {"event": "summary_ready", "summary": result})
    except Exception as exc:
        logger.warning("Failed to deliver summary over WebSocket: %s", exc)


def _run_for_user_sync(db: Session, user: User):
    stats = build_daily_stats_sync(db, user.id)
    try:
        # summary_service.generate_day_end_summary is async — run it in its own loop
        result = asyncio.run(summary_service.generate_day_end_summary(stats))
        
        # Save / Upsert to the DB
        tz = ZoneInfo(user.timezone or "UTC")
        local_date = datetime.now(timezone.utc).astimezone(tz).date()
        
        stmt = insert(DailySummary).values(
            user_id=user.id,
            date=local_date,
            content=result,
        ).on_conflict_do_update(
            constraint="uq_daily_summary_user_date",
            set_={"content": result, "created_at": datetime.now(timezone.utc)},
        )
        db.execute(stmt)
        db.commit()
    except Exception as exc:
        logger.error("Summary generation failed for user %s: %s", user.id, exc)
        return

    # 1. Send Web Push to every device with the full summary embedded.
    devices = (
        db.query(Device)
        .filter(Device.user_id == user.id, Device.push_enabled == True)  # noqa: E712
        .all()
    )
    from app.services.push_service import GoneException
    payload = push_service.build_summary_ready_payload(result)
    push_sent = 0
    push_removed = 0
    for d in devices:
        try:
            push_service.send_push(d.push_token, payload)
            push_sent += 1
            logger.info("[Push] Summary sent to device %s (user %s)", d.id, user.id)
        except GoneException:
            logger.info("[Push] Device %s subscription gone — removing (user %s)", d.id, user.id)
            db.delete(d)
            push_removed += 1
        except Exception as exc:
            logger.warning("[Push] Summary push to device %s failed: %s", d.id, exc)

    # Commit device deletions before publishing the WS summary.
    db.commit()
    logger.info("[Push] Summary result for user %s: sent=%d removed=%d", user.id, push_sent, push_removed)

    # 2. Deliver to open browser tabs instantly.
    _publish_ws_summary(str(user.id), result)


def _run_day_end_summaries_sync():
    from app.database import SyncSessionLocal

    now_utc = datetime.now(timezone.utc)
    with SyncSessionLocal() as db:
        users = db.query(User).all()
        for user in users:
            if not user.daily_summary_enabled:
                continue

            tz = ZoneInfo(user.timezone or "UTC")
            local_hour = now_utc.astimezone(tz).hour
            if local_hour == 21:  # 9pm local — beat runs hourly on the hour
                _run_for_user_sync(db, user)


def run_day_end_summaries():
    _run_day_end_summaries_sync()
