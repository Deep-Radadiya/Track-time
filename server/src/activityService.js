// Saving and reading the activity log.
import { Activity } from './models/Activity.js';
import { localNow, localToUtc, validZone } from './taskService.js';

// Adds one line to the activity log.
// Give either `task` (a task document) or `taskId`, and optionally a title to use instead.
export function recordActivity({ userId, type, source, task, taskId, taskTitle, notes, metadata, timestamp }) {
  const title = (taskTitle || task?.title || 'General activity').trim().slice(0, 500);
  return Activity.create({
    user_id: userId,
    task_id: task ? task._id : taskId ?? null,
    activity_type: type,
    task_title: title,
    optional_notes: notes ? notes.slice(0, 1000) : null,
    source,
    metadata: metadata ?? null,
    ...(timestamp && { timestamp }),
  });
}

// "YYYY-MM-DD" of the user's today, in their own time zone.
export function localDateString(timeZone, now = new Date()) {
  const { year, month, day } = localNow(now, validZone(timeZone || 'UTC'));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// The start and end of a day in the user's time zone, as UTC moments.
export function dayBounds(dateString, timeZone) {
  const [year, month, day] = dateString.split('-').map(Number);
  const zone = validZone(timeZone || 'UTC');
  return { start: localToUtc(year, month, day, 0, zone), end: localToUtc(year, month, day + 1, 0, zone) };
}
