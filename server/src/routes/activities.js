// Routes: GET /activities (the log) and POST /activities/submit (write an update).
import { Router } from 'express';
import mongoose from 'mongoose';
import { Activity, ACTIVITY_TYPES, ACTIVITY_SOURCES } from '../models/Activity.js';
import { Task } from '../models/Task.js';
import { ReminderLog } from '../models/ReminderLog.js';
import { requireLogin } from '../auth.js';
import { extractIntent } from '../intent.js';
import { recordActivity, localDateString, dayBounds } from '../activityService.js';

const router = Router();
router.use(requireLogin);

const SESSION_STATUSES = ['productive', 'average', 'needs_improvement'];

const bad = (res, message) => res.status(422).json({ detail: message });

// Filters: ?today=true  ?date=2026-10-02  ?limit=50  ?activity_type=...  ?source=...
router.get('/', async (req, res) => {
  const { today, date, activity_type, source } = req.query;
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return bad(res, 'limit must be between 1 and 200');
  if (activity_type && !ACTIVITY_TYPES.includes(activity_type)) return bad(res, 'Invalid activity_type');
  if (source && !ACTIVITY_SOURCES.includes(source)) return bad(res, 'Invalid source');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad(res, 'date must look like 2026-10-02');

  const filter = { user_id: req.user._id };
  if (today === 'true' || date) {
    const { start, end } = dayBounds(date || localDateString(req.user.timezone), req.user.timezone);
    filter.timestamp = { $gte: start, $lt: end };
  }
  if (activity_type) filter.activity_type = activity_type;
  if (source) filter.source = source;

  res.json(await Activity.find(filter).sort({ timestamp: -1 }).limit(limit));
});

// Reminders that were sent but never answered: ?date=2026-10-02  ?task_id=...
// A reminder counts as missed once the next one is due (or the next one has already been sent).
router.get('/missed', async (req, res) => {
  const { date, task_id } = req.query;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad(res, 'date must look like 2026-10-02');
  if (task_id && !mongoose.isValidObjectId(task_id)) return res.json([]);

  const { start, end } = dayBounds(date || localDateString(req.user.timezone), req.user.timezone);
  const filter = { user_id: req.user._id, due_at: { $gte: start, $lt: end } };
  if (task_id) filter.task_id = task_id;
  const logs = await ReminderLog.find(filter).sort({ due_at: 1 });
  if (logs.length === 0) return res.json([]);

  // Which reminders already have an update written for them.
  const answered = new Set(
    (await Activity.find({
      user_id: req.user._id,
      'metadata.event': 'reminder_response',
      'metadata.reminder_at': { $in: logs.map((l) => l.due_at.toISOString()) },
    }).select('metadata.reminder_at').lean()).map((a) => a.metadata.reminder_at),
  );

  // Deleted reminders are left out.
  const tasks = await Task.find({ _id: { $in: [...new Set(logs.map((l) => String(l.task_id)))] } }).select('title interval_minutes').lean();
  const taskById = new Map(tasks.map((t) => [String(t._id), t]));

  const lastSent = new Map(); // task id -> its latest reminder in this day
  for (const l of logs) lastSent.set(String(l.task_id), l.due_at.getTime());

  const now = Date.now();
  res.json(
    logs
      .filter((l) => {
        const task = taskById.get(String(l.task_id));
        if (!task || answered.has(l.due_at.toISOString())) return false;
        const nextSent = lastSent.get(String(l.task_id)) > l.due_at.getTime();
        const nextDue = now >= l.due_at.getTime() + (task.interval_minutes || 30) * 60000;
        return nextSent || nextDue;
      })
      .map((l) => ({ id: String(l._id), task_id: String(l.task_id), task_title: taskById.get(String(l.task_id)).title, due_at: l.due_at })),
  );
});

// The user writes (or speaks) an update like "Blocked because Docker won't start".
router.post('/submit', async (req, res) => {
  const { text, source, task_id, session_status, reminder_time } = req.body;
  if (session_status != null && !SESSION_STATUSES.includes(session_status)) return bad(res, 'Invalid session_status');
  // The note is optional when a session status icon was picked.
  if (typeof text !== 'string' || text.length > 2000 || (text.trim().length < 1 && session_status == null)) return bad(res, 'text must be 1 to 2000 characters, or pick a session status');
  if (source !== 'voice' && source !== 'text') return bad(res, "source must be 'voice' or 'text'");

  // An update written for a reminder is saved at the time that reminder was due (never in the future).
  let timestamp;
  if (reminder_time != null) {
    const when = new Date(reminder_time);
    if (Number.isNaN(when.getTime())) return bad(res, 'Invalid reminder_time');
    if (when <= new Date()) timestamp = when;
  }

  const intent = extractIntent(text);
  let type = intent.activity_type;
  if (type === 'status_update') type = source === 'voice' ? 'voice_update' : 'text_update';

  // Only link the task if it really is this user's.
  let taskId = null;
  if (task_id && mongoose.isValidObjectId(task_id)) {
    const task = await Task.findOne({ _id: task_id, user_id: req.user._id });
    taskId = task ? task._id : null;
    // No reminder time sent: use the time of the reminder that was last sent for this task.
    if (!timestamp && task?.last_reminded_at && task.last_reminded_at <= new Date()) timestamp = task.last_reminded_at;
  }

  const activity = await recordActivity({
    userId: req.user._id,
    taskId,
    type,
    taskTitle: intent.task_title,
    notes: intent.optional_notes,
    source,
    timestamp,
    // reminder_at links the update to the reminder it answers, so that reminder is no longer "missed".
    metadata: { event: 'reminder_response', raw_text: text, ...(timestamp && { reminder_at: timestamp.toISOString() }), ...(session_status && { session_status }) },
  });
  res.status(201).json(activity);
});

// Edit the text of an update you wrote earlier (today or any past day).
router.patch('/:id', async (req, res) => {
  const { text, session_status } = req.body;
  if (typeof text !== 'string' || text.length > 2000) return bad(res, 'text must be at most 2000 characters');
  if (session_status != null && !SESSION_STATUSES.includes(session_status)) return bad(res, 'Invalid session_status');
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ detail: 'Update not found' });

  const activity = await Activity.findOne({ _id: req.params.id, user_id: req.user._id });
  if (!activity || activity.metadata?.event !== 'reminder_response') return res.status(404).json({ detail: 'Update not found' });

  // The icon can be changed too: a value sets it, null clears it, leaving it out keeps it.
  const status = session_status !== undefined ? session_status : activity.metadata?.session_status ?? null;
  if (text.trim().length < 1 && !status) return bad(res, 'text must be 1 to 2000 characters, or pick a session status');

  const metadata = { ...activity.metadata, raw_text: text.trim(), edited_at: new Date().toISOString() };
  if (status) metadata.session_status = status;
  else delete metadata.session_status;
  activity.metadata = metadata;
  await activity.save();
  res.json(activity);
});

export default router;
