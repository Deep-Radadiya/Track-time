// The job that runs every minute: ask users "what are you working on?" during their working hours.
import { User } from '../models/User.js';
import { sendToUser } from '../push.js';
import { createActionToken } from '../auth.js';
import { localNow, validZone } from '../taskService.js';
import { inWindow, markExpiredMissed, needsCheckin, slotStartUtc, createPendingCheckin } from '../checkinService.js';

// Sends the "what are you working on?" notification to every device of the user.
export function sendCheckinReminder(user, reminder = null) {
  return sendToUser(user._id, {
    type: 'checkin',
    tag: 'hourly-checkin',
    title: 'Hourly Reminder',
    body: 'What are you working on right now?',
    action_token: createActionToken(user.id),
    reminder_id: reminder ? reminder.id : null,
  });
}

// `now` can be passed in for testing.
export async function runHourlyCheckins(now = new Date()) {
  const users = await User.find({ checkin_enabled: true });

  for (const user of users) {
    try {
      const seconds = localNow(now, validZone(user.timezone || 'UTC')).seconds;
      if (!inWindow(seconds, user.working_hours_start, user.working_hours_end)) continue; // not working time

      await markExpiredMissed(user, now);

      if (await needsCheckin(user, now)) {
        const reminder = await createPendingCheckin(user, slotStartUtc(user, now));
        await sendCheckinReminder(user, reminder);
      }
    } catch (err) {
      console.error(`[Job] check-in failed for user ${user.id}:`, err); // one user must not stop the others
    }
  }
}

// The "remind me later" button: ask again after a few minutes.
// (Kept in memory, so it is lost if the server restarts. That is fine for a 10 minute delay.)
export function scheduleDelayedCheckin(userId, minutes = 10) {
  setTimeout(async () => {
    try {
      const user = await User.findById(userId);
      if (user) await sendCheckinReminder(user);
    } catch (err) {
      console.error('[Job] delayed check-in failed:', err);
    }
  }, minutes * 60 * 1000);
}
