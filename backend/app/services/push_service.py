"""
Web Push wrapper around pywebpush. Device targeting and quiet-hours logic
live in workers/reminder_tasks.py; this module just knows how to send.
"""
import json
import logging

from pywebpush import webpush, WebPushException

from app.config import settings

logger = logging.getLogger(__name__)


class GoneException(Exception):
    """Raised when a push subscription returns HTTP 410 Gone (expired/unsubscribed)."""


def send_push(push_token_json: str, payload: dict) -> bool:
    """push_token_json is the JSON-encoded PushSubscription stored on Device.

    Returns True on success, False on non-fatal errors.
    Raises GoneException if the subscription is expired (HTTP 410) — callers
    should delete the device record so it is never retried.
    """
    try:
        subscription_info = json.loads(push_token_json)
    except json.JSONDecodeError:
        logger.error("Invalid push_token JSON on device")
        return False

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIMS_SUB},
            ttl=86400,
        )
        endpoint = subscription_info.get("endpoint", "unknown")[:60]
        logger.info("[Push] Sent OK → endpoint=%s type=%s", endpoint, payload.get("type", "?"))
        return True
    except WebPushException as e:
        status_code = e.response.status_code if hasattr(e, "response") and e.response is not None else None
        body = e.response.text if hasattr(e, "response") and hasattr(e.response, "text") else "No response body"
        if status_code in (404, 410):
            # Subscription has been unsubscribed or expired — caller must delete the record.
            raise GoneException(f"Subscription gone ({status_code}): {body}") from e
        logger.warning(f"Push failed: {e}\nResponse body: {body}")
        return False


def build_reminder_payload(reminder_id: str, title: str) -> dict:
    return {
        "type": "reminder",
        "tag": f"reminder-{reminder_id}",
        "reminder_id": reminder_id,
        "title": "SmartReminder",
        "body": f"It's time for: {title}",
    }
