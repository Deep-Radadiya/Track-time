// Routes: create, list, edit, delete reminders, and actions like done / snooze / start.
import { Router } from 'express';
import mongoose from 'mongoose';
import { Task, STATUSES, RECURRENCES, SOURCES } from '../models/Task.js';
import { requireLogin } from '../auth.js';
import { recordActivity } from '../activityService.js';
import { broadcast } from '../websocket.js';
import { sendToUser, cancelPayload } from '../push.js';
import { nextWindowSlot, rollWindowForward, applyAction, InvalidAction, normalizeTime, toSeconds } from '../taskService.js';

const router = Router();
router.use(requireLogin); // every route here needs a logged-in user

const bad = (res, message) => res.status(422).json({ detail: message });

// Turns a value into a Date. undefined -> undefined, null -> null, invalid text -> NaN.
const toDate = (v) => (v === undefined || v === null ? v : new Date(v));
const isBadDate = (d) => d instanceof Date && isNaN(d);

// Finds one task of the logged-in user. Returns null if it does not exist or is not theirs.
async function findTask(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return Task.findOne({ _id: req.params.id, user_id: req.user._id });
}

// Tell the user's other devices to remove this reminder's notification (in the background).
const cancelNotification = (userId, taskId) => {
  sendToUser(userId, cancelPayload(taskId)).catch((err) => console.warn('[Push] cancel failed:', err.message));
};

// What happened, as an activity type.
const TYPE_FOR_ACTION = { done: 'completed', snooze: 'snoozed', start: 'started', block: 'blocked', reopen: 'resumed' };
const TYPE_FOR_STATUS = { done: 'completed', blocked: 'blocked', in_progress: 'started', pending: 'resumed', snoozed: 'snoozed' };

// ---------- Create ----------
router.post('/', async (req, res) => {
  const b = req.body;
  if (!b.title || typeof b.title !== 'string') return bad(res, 'title is required');

  const recurrence = b.recurrence ?? 'none';
  const source = b.source ?? 'text';
  if (!RECURRENCES.includes(recurrence)) return bad(res, 'Invalid recurrence');
  if (!SOURCES.includes(source)) return bad(res, 'Invalid source');

  let dueAt = toDate(b.due_at);
  if (isBadDate(dueAt)) return bad(res, 'Invalid due_at');

  // Time window: both ends together, end after start, and an interval.
  const hasWindow = b.window_start != null || b.window_end != null;
  const windowStart = hasWindow ? normalizeTime(b.window_start) : null;
  const windowEnd = hasWindow ? normalizeTime(b.window_end) : null;
  if (hasWindow) {
    if (!windowStart || !windowEnd) return bad(res, 'window_start and window_end must be set together');
    if (toSeconds(windowEnd) <= toSeconds(windowStart)) return bad(res, 'End time must be after start time');
    if (!(b.interval_minutes > 0)) return bad(res, 'interval_minutes is required with a time window');
  }

  // Lunch break: both ends together, end after start.
  const hasLunch = b.lunch_start != null || b.lunch_end != null;
  const lunchStart = hasLunch ? normalizeTime(b.lunch_start) : null;
  const lunchEnd = hasLunch ? normalizeTime(b.lunch_end) : null;
  if (hasLunch) {
    if (!lunchStart || !lunchEnd) return bad(res, 'lunch_start and lunch_end must be set together');
    if (toSeconds(lunchEnd) <= toSeconds(lunchStart)) return bad(res, 'Lunch end must be after lunch start');
  }

  let finalRecurrence = recurrence;
  if (hasWindow) {
    // The first reminder is the next free slot inside the window.
    finalRecurrence = 'interval';
    dueAt = nextWindowSlot(new Date(), req.user.timezone, windowStart, windowEnd, b.interval_minutes, lunchStart, lunchEnd);
    if (!dueAt) return bad(res, 'No reminder slots fit in that time window');
  }

  const task = await Task.create({
    user_id: req.user._id,
    title: b.title,
    recurrence: finalRecurrence,
    due_at: dueAt ?? null,
    anchor_time: dueAt ?? null, // the anchor starts as the first due time
    next_due_at: dueAt ?? null,
    interval_minutes: b.interval_minutes ?? null,
    window_start: windowStart,
    window_end: windowEnd,
    lunch_start: lunchStart,
    lunch_end: lunchEnd,
    category: b.category ?? null,
    source,
    notes: Array.isArray(b.notes) ? b.notes.map((n) => ({ text: n.text, done: !!n.done, order_index: n.order_index ?? 0 })) : [],
  });
  await recordActivity({
    userId: req.user._id, task, type: 'created', source: task.source,
    metadata: { event: 'task_created', recurrence: task.recurrence, due_at: task.due_at ? task.due_at.toISOString() : null },
  });
  broadcast(req.user.id, { event: 'task_created', task_id: task.id });
  res.status(201).json(task);
});

// ---------- List ----------
router.get('/', async (req, res) => {
  const skip = Math.max(parseInt(req.query.skip) || 0, 0);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
  const tasks = await Task.find({ user_id: req.user._id }).sort({ created_at: 1 }).skip(skip).limit(limit);
  res.json(tasks);
});

// Newest tasks first. (This must be above "/:id" routes so "recent" is not read as an id.)
router.get('/recent', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 1, 1), 200);
  const tasks = await Task.find({ user_id: req.user._id }).sort({ created_at: -1 }).limit(limit);
  res.json(tasks);
});

// ---------- Edit ----------
router.patch('/:id', async (req, res) => {
  const task = await findTask(req);
  if (!task) return res.status(404).json({ detail: 'Task not found' });

  const b = req.body;
  if (b.status !== undefined && !STATUSES.includes(b.status)) return bad(res, 'Invalid status');
  if (b.recurrence !== undefined && !RECURRENCES.includes(b.recurrence)) return bad(res, 'Invalid recurrence');
  const dueAt = toDate(b.due_at);
  if (isBadDate(dueAt)) return bad(res, 'Invalid due_at');

  const oldStatus = task.status;
  // A new time or a finished/blocked status makes the old notification outdated.
  const dueChanged = b.due_at !== undefined && (dueAt?.getTime() ?? null) !== (task.due_at?.getTime() ?? null);
  const statusEnds = b.status !== undefined && b.status !== oldStatus && ['done', 'blocked'].includes(b.status);
  if (dueChanged || statusEnds) cancelNotification(req.user._id, task._id);

  for (const field of ['title', 'status', 'recurrence', 'interval_minutes', 'category']) {
    if (b[field] !== undefined) task[field] = b[field];
  }
  if (b.due_at !== undefined) {
    // Keep the three time fields in sync so the scheduler fires at the right time.
    task.due_at = task.next_due_at = task.anchor_time = dueAt;
  }
  await task.save();

  const statusChanged = b.status !== undefined && b.status !== oldStatus;
  await recordActivity({
    userId: req.user._id, task, source: 'task',
    type: statusChanged ? TYPE_FOR_STATUS[b.status] ?? 'updated' : 'updated',
    metadata: { event: 'task_updated', changed_fields: Object.keys(b).sort() },
  });
  broadcast(req.user.id, { event: 'task_updated', task_id: task.id });
  res.json(task);
});

// ---------- Delete ----------
router.delete('/:id', async (req, res) => {
  const task = await findTask(req);
  if (!task) return res.status(404).json({ detail: 'Task not found' });
  cancelNotification(req.user._id, task._id);
  await recordActivity({ userId: req.user._id, task, type: 'deleted', source: 'task', metadata: { event: 'task_deleted' } });
  await task.deleteOne();
  broadcast(req.user.id, { event: 'task_deleted', task_id: task.id });
  res.status(204).end();
});

// ---------- Action: done / snooze / start / block / reopen ----------
router.post('/:id/action', async (req, res) => {
  const task = await findTask(req);
  if (!task) return res.status(404).json({ detail: 'Task not found' });

  const { action, client_timestamp, snooze_minutes } = req.body;
  if (!action) return bad(res, 'action is required');
  const clientTimestamp = new Date(client_timestamp);
  if (!client_timestamp || isBadDate(clientTimestamp)) return bad(res, 'client_timestamp is required');

  try {
    const changed = applyAction(task, action, clientTimestamp, snooze_minutes);
    if (changed) {
      // Turning a window reminder back on: pick its next slot (block cleared it).
      if (action === 'reopen') rollWindowForward(task, req.user, new Date());
      await task.save();
      await recordActivity({
        userId: req.user._id, task, source: 'task',
        type: TYPE_FOR_ACTION[action] ?? 'status_update',
        notes: action === 'snooze' ? `Snoozed for ${snooze_minutes || 10} minutes` : null,
        metadata: { event: 'task_action', action, client_timestamp: clientTimestamp.toISOString() },
      });
      broadcast(req.user.id, { event: 'task_action', task_id: task.id, action });
      if (['done', 'snooze', 'block'].includes(action)) cancelNotification(req.user._id, task._id);
    }
  } catch (err) {
    if (err instanceof InvalidAction) return res.status(400).json({ detail: err.message });
    throw err;
  }
  res.json(task);
});

export default router;
