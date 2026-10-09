// The reminder logic: when does a reminder fire next, and what happens on done / snooze / etc.
// This file has no database code, so it is easy to read and test.

const SNOOZE_MERGE_WINDOW_MINUTES = 20;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// ---------- Time helpers ----------

// "9:00" or "09:00:00" -> "09:00:00". Returns null when it is not a valid time.
export function normalizeTime(value) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? ''));
  if (!m || +m[1] > 23 || +m[2] > 59 || +(m[3] ?? 0) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}`;
}

// "09:30:00" -> 34200 (seconds since midnight)
export function toSeconds(time) {
  const [h, m, s] = time.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

// The clock reading a moment has in a time zone, as numbers: { year, month, day, hour, minute, second }.
// Both helpers below need it, so it lives in one place.
function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, +p.value]));
}

// How far ahead of UTC a time zone is at a given moment, in milliseconds.
function offsetMs(date, timeZone) {
  const v = zonedParts(date, timeZone);
  const localAsUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
  return localAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// A local date + seconds-since-midnight in a time zone -> the real UTC moment.
export function localToUtc(year, month, day, seconds, timeZone) {
  const guess = Date.UTC(year, month - 1, day, 0, 0, seconds);
  let utc = guess - offsetMs(new Date(guess), timeZone);
  utc = guess - offsetMs(new Date(utc), timeZone); // second pass handles daylight saving changes
  return new Date(utc);
}

// Returns the time zone name if the computer knows it, otherwise 'UTC' (so a bad value never crashes us).
export function validZone(name) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return name;
  } catch {
    return 'UTC';
  }
}

// The date and time of day a moment has in a time zone: { year, month, day, seconds }.
export function localNow(date, timeZone) {
  const v = zonedParts(date, timeZone);
  return { year: v.year, month: v.month, day: v.day, seconds: v.hour * 3600 + v.minute * 60 + v.second };
}

// A moment written in the user's own time zone, e.g. "2026-10-02T11:30:00+05:30".
export function localIso(date, timeZone) {
  const zone = validZone(timeZone || 'UTC');
  const { year, month, day, seconds } = localNow(date, zone);
  const pad = (n) => String(n).padStart(2, '0');
  const offsetMin = Math.round(offsetMs(date, zone) / 60000);
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  return `${year}-${pad(month)}-${pad(day)}T${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

// If the user is in quiet hours right now, returns the moment quiet hours end. Otherwise null.
// Quiet hours can wrap midnight, e.g. 22:00 to 07:00.
export function quietHoursEnd(user, now) {
  if (!user.quiet_hours_start || !user.quiet_hours_end) return null;
  const zone = validZone(user.timezone || 'UTC');
  const local = localNow(now, zone);
  const start = toSeconds(user.quiet_hours_start);
  const end = toSeconds(user.quiet_hours_end);

  const isQuiet = start <= end
    ? local.seconds >= start && local.seconds < end
    : local.seconds >= start || local.seconds < end;
  if (!isQuiet) return null;

  let endsAt = localToUtc(local.year, local.month, local.day, end, zone);
  if (endsAt <= now) endsAt = localToUtc(local.year, local.month, local.day + 1, end, zone); // ends tomorrow
  return endsAt;
}

// ---------- Time-window reminders ----------

// First reminder slot after `after` (a Date), as a UTC Date. Or null if none fits.
// Slots start at windowStart and repeat every intervalMinutes until windowEnd (user's local time).
// Slots inside lunch are skipped. If today is used up, it moves on to the next day.
export function nextWindowSlot(after, timeZone, windowStart, windowEnd, intervalMinutes, lunchStart, lunchEnd) {
  if (!(intervalMinutes > 0)) return null;
  const zone = validZone(timeZone || 'UTC');

  // The date "after" has in the user's time zone.
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(after);
  const p = Object.fromEntries(local.map((x) => [x.type, +x.value]));

  const start = toSeconds(windowStart);
  const end = toSeconds(windowEnd);
  const step = intervalMinutes * 60;
  const lunchFrom = lunchStart ? toSeconds(lunchStart) : null;
  const lunchTo = lunchEnd ? toSeconds(lunchEnd) : null;

  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    // Date.UTC fixes overflow, e.g. day 32 becomes the 1st of next month.
    const day = new Date(Date.UTC(p.year, p.month - 1, p.day + dayOffset));
    for (let sec = start; sec <= end; sec += step) {
      const inLunch = lunchFrom !== null && sec >= lunchFrom && sec < lunchTo;
      if (inLunch) continue;
      const slot = localToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), sec, zone);
      if (slot > after) return slot;
    }
  }
  return null;
}

// For a window reminder that just fired (or could not fire), set next_due_at to the next slot.
export function rollWindowForward(task, user, now) {
  if (!task.window_start || !task.window_end || !task.interval_minutes) return;
  if (task.snoozed_until) return;
  if (task.next_due_at && task.next_due_at > now) return;
  task.next_due_at = nextWindowSlot(
    now, user.timezone, task.window_start, task.window_end,
    task.interval_minutes, task.lunch_start, task.lunch_end,
  );
}

// ---------- Repeating reminders ----------

// Moves next_due_at forward. Always counts from the ORIGINAL anchor_time, never from "now",
// so finishing a bit late every day does not slowly shift the schedule.
export function advanceRecurrence(task, completedAt) {
  if (task.recurrence === 'none' || !task.anchor_time) return;
  if (task.window_start) return; // window reminders are moved forward by the scheduler

  const anchor = task.anchor_time.getTime();
  const elapsed = completedAt.getTime() - anchor;
  let step;
  if (task.recurrence === 'interval') {
    if (!task.interval_minutes) return;
    step = task.interval_minutes * MINUTE;
  } else if (task.recurrence === 'daily') {
    step = DAY;
  } else {
    step = 7 * DAY; // weekly
  }
  const passed = Math.max(Math.floor(elapsed / step), 0);
  task.next_due_at = new Date(anchor + step * (passed + 1));
}

// ---------- Actions: done, snooze, start, block, reopen ----------

export class InvalidAction extends Error {}

// Applies an action to the task (in memory). Returns true if something changed,
// false if it was ignored (the same or an older action was already applied).
export function applyAction(task, action, clientTimestamp, snoozeMinutes) {
  if (task.last_action_client_ts && clientTimestamp <= task.last_action_client_ts) return false;

  let changed = false;

  if (action === 'done') {
    changed = task.status !== 'done';
    if (task.recurrence === 'none') {
      task.status = 'done';
    } else {
      task.status = 'pending'; // repeating reminders start over
      advanceRecurrence(task, clientTimestamp);
    }
    task.snoozed_until = null;
    task.snoozed_count_today = 0;
  } else if (action === 'snooze') {
    const proposed = new Date(clientTimestamp.getTime() + (snoozeMinutes || 10) * MINUTE);
    task.snoozed_until = proposed;
    task.status = 'snoozed';
    task.snoozed_count_today += 1;
    task.snoozed_count_total += 1;
    // If the snooze lands very close to the next due time, merge them into one reminder.
    if (task.next_due_at) {
      const minutesApart = Math.abs(proposed - task.next_due_at) / MINUTE;
      if (minutesApart <= SNOOZE_MERGE_WINDOW_MINUTES) task.next_due_at = proposed;
    }
    changed = true;
  } else if (action === 'start') {
    if (task.status !== 'in_progress') {
      task.status = 'in_progress';
      changed = true;
    }
  } else if (action === 'block') {
    if (task.status !== 'blocked') {
      task.status = 'blocked';
      task.next_due_at = null;
      task.snoozed_until = null;
      changed = true;
    }
  } else if (action === 'reopen') {
    if (task.status !== 'pending') {
      task.status = 'pending';
      task.snoozed_until = null;
      if (task.recurrence !== 'none') advanceRecurrence(task, clientTimestamp);
      changed = true;
    }
  } else {
    throw new InvalidAction(`Unknown action: ${action}`);
  }

  task.last_action_client_ts = clientTimestamp;
  return changed;
}
