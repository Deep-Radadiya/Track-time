// Sends Web Push notifications to a browser. It only knows how to send.
// Who to send to, and when, is decided by the routes and the scheduler.
import webpush from 'web-push';
import { config } from './config.js';
import { createActionToken } from './auth.js';
import { Device } from './models/Device.js';

// Thrown when the browser says "this subscription no longer exists" (HTTP 404 / 410).
// The caller should delete that device.
export class GoneError extends Error {}

if (config.vapidPublicKey && config.vapidPrivateKey) {
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
}

// pushToken is the saved JSON text of the browser's subscription.
// Returns true if sent, false on a small error. Throws GoneError if the device is gone.
export async function sendPush(pushToken, payload) {
  let subscription;
  try {
    subscription = JSON.parse(pushToken);
  } catch {
    console.error('[Push] Invalid push token on a device');
    return false;
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 86400 });
    console.log(`[Push] Sent OK type=${payload.type ?? '?'}`);
    return true;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      throw new GoneError(`Subscription gone (${err.statusCode})`);
    }
    console.warn(`[Push] Failed: ${err.statusCode ?? ''} ${err.message}`);
    return false;
  }
}

// The notification for a due reminder. The action token lets the notification's
// buttons (Done / Snooze) work without the user being logged in.
export function reminderPayload(task, userId, dueAt) {
  return {
    type: 'reminder',
    tag: `task-${task.id}`,
    task_id: String(task.id),
    title: task.title,
    due_at: dueAt.toISOString(),
    action_token: createActionToken(userId),
  };
}

// A silent message that tells other devices to remove the notification.
export const cancelPayload = (taskId) => ({
  type: 'cancel',
  tag: `task-${taskId}`,
  task_id: String(taskId),
  silent: true,
});

// Sends one notification to every push-enabled device of a user.
// Devices whose subscription is gone are deleted. Never throws.
export async function sendToUser(userId, payload) {
  const devices = await Device.find({ user_id: userId, push_enabled: true });
  let sent = 0;
  for (const device of devices) {
    try {
      if (await sendPush(device.push_token, payload)) sent++;
    } catch (err) {
      if (err instanceof GoneError) await device.deleteOne();
      else console.warn(`[Push] device ${device.id} failed: ${err.message}`);
    }
  }
  return sent;
}

// The notification for the day-end summary. The text is put in the notification itself,
// so the user can read it without opening the app.
export function summaryPayload(summary) {
  const parts = [];
  if (summary.highlight) parts.push(`✨ ${summary.highlight}`);
  if (summary.concern) parts.push(`⚠️ ${summary.concern}`);
  return {
    type: 'summary_ready',
    tag: 'day-end-summary',
    title: 'Day-End Summary',
    body: parts.length ? parts.join(' • ') : summary.summary || 'Your day-end summary is ready.',
    summary,
  };
}
