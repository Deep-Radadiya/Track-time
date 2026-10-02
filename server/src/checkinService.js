// The logic of the hourly "what are you working on?" check-ins: when is one due, and what happens to it.
import { CheckinReminder } from './models/CheckinReminder.js';
import { ProductivityLog } from './models/ProductivityLog.js';
import { recordActivity } from './activityService.js';
import { localNow, localToUtc, toSeconds, validZone } from './taskService.js';

const MINUTE = 60 * 1000;
const SCHEDULER_WINDOW_MINUTES = 2; // a check-in is created in the first 2 minutes of each period

// Is a time of day inside a window? The window may cross midnight (e.g. 22:00 to 06:00).
export function inWindow(seconds, start, end) {
  if (!start || !end) return false;
  const from = toSeconds(start);
  const to = toSeconds(end);
  return from <= to ? seconds >= from && seconds < to : seconds >= from || seconds < to;
}

// If a check-in is due right now, returns the START of the period it asks about. Otherwise null.
// Example: working hours start at 9:00, interval 60 minutes. At 11:00 we ask about 10:00 to 11:00,
// so the check-in's time is 10:00.
export function slotStartUtc(user, now) {
  const zone = validZone(user.timezone || 'UTC');
  const local = localNow(now, zone);

  if (!inWindow(local.seconds, user.working_hours_start, user.working_hours_end)) return null; // not working time
  if (inWindow(local.seconds, user.quiet_hours_start, user.quiet_hours_end)) return null; // quiet hours

  const interval = user.checkin_interval_minutes || 60;
  const startSeconds = toSeconds(user.working_hours_start);

  // When did today's working time begin? (If it crosses midnight and it is past midnight, it began yesterday.)
  const startedYesterday = user.working_hours_start > user.working_hours_end && local.seconds < startSeconds;
  const workStart = localToUtc(local.year, local.month, local.day - (startedYesterday ? 1 : 0), startSeconds, zone);

  const elapsed = Math.floor((now - workStart) / MINUTE);
  if (elapsed < interval) return null; // the first period is not over yet

  const sinceDue = elapsed % interval;
  if (sinceDue >= SCHEDULER_WINDOW_MINUTES) return null; // we are past the moment it was due

  const previousSlot = elapsed - sinceDue - interval;
  return new Date(workStart.getTime() + previousSlot * MINUTE);
}

// Should we ask this user now? Not if they already answered, or we already asked, for this period.
export async function needsCheckin(user, now) {
  const slot = slotStartUtc(user, now);
  if (!slot) return false;

  if (await ProductivityLog.exists({ user_id: user._id, start_at: { $gte: slot } })) return false; // already logged

  const windowEnd = new Date(slot.getTime() + 10 * MINUTE);
  if (await CheckinReminder.exists({ user_id: user._id, scheduled_time: { $gte: slot, $lt: windowEnd } })) return false; // already asked

  return true;
}

// Creates the question for a period (or returns the one that exists).
export function createPendingCheckin(user, scheduledTime) {
  return CheckinReminder.findOneAndUpdate(
    { user_id: user._id, scheduled_time: scheduledTime },
    { $setOnInsert: { status: 'pending' } },
    { upsert: true, returnDocument: 'after' }
  );
}

// A question nobody answered for two full periods is marked "missed", and the timeline shows it.
export async function markExpiredMissed(user, now) {
  const interval = user.checkin_interval_minutes || 60;
  const threshold = new Date(now.getTime() - interval * 2 * MINUTE);

  const expired = await CheckinReminder.find({ user_id: user._id, status: 'pending', scheduled_time: { $lte: threshold } });
  for (const reminder of expired) {
    reminder.status = 'missed';
    await reminder.save();
    await recordActivity({
      userId: user._id, type: 'hourly_checkin', source: 'checkin', taskTitle: 'Missed Check-in',
      timestamp: reminder.scheduled_time, // shown at the time it should have been answered
      metadata: { status: 'missed' },
    });
  }
  return expired.length;
}

// When the user answers a check-in, mark the matching question as completed.
export async function linkCheckinToReminder(userId, startAt, responseId, reminderId) {
  let reminder = null;
  if (reminderId) reminder = await CheckinReminder.findOne({ _id: reminderId, user_id: userId });

  if (!reminder) {
    // Otherwise find an unanswered question within 5 minutes of the answer's start time.
    reminder = await CheckinReminder.findOne({
      user_id: userId,
      status: { $in: ['pending', 'missed'] },
      scheduled_time: { $gte: new Date(startAt.getTime() - 5 * MINUTE), $lte: new Date(startAt.getTime() + 5 * MINUTE) },
    }).sort({ scheduled_time: -1 });
  }
  if (!reminder) return null;

  reminder.status = 'completed';
  reminder.response_id = responseId;
  await reminder.save();
  return reminder;
}

// Today's numbers for the productivity page.
export async function getTodayStats(userId, now) {
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const logs = await ProductivityLog.find({ user_id: userId, start_at: { $gte: todayStart } });

  const total = logs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
  const focused = logs.filter((l) => l.status === 'focused').reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
  const round1 = (n) => Math.round(n * 10) / 10;

  return {
    today_productive_hours: round1(focused / 3600),
    focus_percentage: round1(total > 0 ? (focused / total) * 100 : 0),
    total_sessions_today: logs.length,
    missed_checkins: 0,
    current_streak: focused > 0 ? 1 : 0, // simplified, like before
    longest_streak: focused > 0 ? 1 : 0,
  };
}
