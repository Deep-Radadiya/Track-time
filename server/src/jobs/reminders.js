// The job that runs every minute: find reminders that are due and send the notification.
//
// Why times are stored in UTC: "is it due?" is then one plain comparison with the current time.
// We only convert to the user's own time zone for quiet hours and time windows.
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { Device } from '../models/Device.js';
import { NotificationLog } from '../models/NotificationLog.js';
import { sendPush, reminderPayload, GoneError } from '../push.js';
import { broadcast } from '../websocket.js';
import { quietHoursEnd, rollWindowForward, advanceRecurrence } from '../taskService.js';

export async function checkDueReminders() {
  const now = new Date();

  // A reminder is due when ANY of these is true:
  //  1. next_due_at has passed  (the normal case)
  //  2. its snooze time has passed
  //  3. it has a due_at that passed, but next_due_at was never set (fallback)
  const dueTasks = await Task.find({
    status: { $in: ['pending', 'in_progress', 'snoozed'] },
    $or: [
      { next_due_at: { $ne: null, $lte: now } },
      { snoozed_until: { $ne: null, $lte: now } },
      { due_at: { $ne: null, $lte: now }, next_due_at: null, snoozed_until: null },
    ],
  });
  console.log(`[Job] check_due_reminders: ${dueTasks.length} due`);

  for (const task of dueTasks) {
    try {
      await sendReminder(task, now);
    } catch (err) {
      // One broken reminder must not stop the others.
      console.error(`[Job] reminder ${task.id} failed:`, err);
    }
  }
}

async function sendReminder(task, now) {
  const user = await User.findById(task.user_id);
  if (!user || !user.reminders_enabled) return;

  // Quiet hours: do not send now, try again when quiet hours end.
  const quietUntil = quietHoursEnd(user, now);
  if (quietUntil) {
    if (task.snoozed_until && task.snoozed_until <= now) task.snoozed_until = quietUntil;
    else task.next_due_at = quietUntil;
    await task.save();
    broadcast(user.id, { event: 'task_updated', task_id: task.id });
    return;
  }

  const devices = await Device.find({ user_id: user._id, push_enabled: true });
  if (devices.length === 0) {
    rollWindowForward(task, user, now);
    await task.save();
    broadcast(user.id, { event: 'task_updated', task_id: task.id });
    return;
  }

  const dueAt = task.next_due_at || task.snoozed_until || task.due_at || now;
  const payload = reminderPayload(task, user._id, dueAt);

  for (const device of devices) {
    try {
      if (await sendPush(device.push_token, payload)) {
        await NotificationLog.create({ task_id: task._id, device_id: device._id });
      }
    } catch (err) {
      if (err instanceof GoneError) await device.deleteOne(); // the browser unsubscribed
      else console.warn(`[Push] device ${device.id} failed: ${err.message}`);
    }
  }

  task.last_reminded_at = dueAt;

  // Clear the time that just fired, so we do not send again 60 seconds later.
  // Snooze is checked first because it takes priority.
  if (task.snoozed_until && task.snoozed_until <= now) task.snoozed_until = null;
  else if (task.next_due_at && task.next_due_at <= now) task.next_due_at = null;

  if (task.recurrence === 'none') {
    if (task.due_at && task.due_at <= now) task.due_at = null; // a one-time reminder is finished
  } else if (!task.next_due_at) {
    advanceRecurrence(task, now); // a repeating reminder moves on to its next occurrence
  }

  rollWindowForward(task, user, now); // window reminders get their next slot
  await task.save();
  broadcast(user.id, { event: 'task_updated', task_id: task.id }); // so open screens show the new time
}
