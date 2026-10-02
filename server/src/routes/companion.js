// Routes: /companion/chat, /companion/current-task, /companion/checkin..., /companion/productivity/summary
import { Router } from 'express';
import mongoose from 'mongoose';
import { requireLogin } from '../auth.js';
import { Task } from '../models/Task.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { CurrentTask } from '../models/CurrentTask.js';
import { processChatMessage } from '../companion/chat.js';
import { ProductivityLog, PRODUCTIVITY_STATUSES } from '../models/ProductivityLog.js';
import { CheckinReminder, REMINDER_STATUSES } from '../models/CheckinReminder.js';
import { recordActivity } from '../activityService.js';
import { linkCheckinToReminder, getTodayStats } from '../checkinService.js';
import { scheduleDelayedCheckin } from '../jobs/checkins.js';

const router = Router();
router.use(requireLogin);

const bad = (res, message) => res.status(422).json({ detail: message });
const idOrNull = (v) => (v === undefined || v === null ? null : v);

// ---------- Chat ----------

router.post('/chat', async (req, res) => {
  const { content } = req.body;
  const taskId = idOrNull(req.body.task_id);
  if (typeof content !== 'string' || content.length < 1 || content.length > 32000) return bad(res, 'content must be 1 to 32000 characters');
  if (taskId !== null && !mongoose.isValidObjectId(taskId)) return bad(res, 'task_id is not valid');

  res.status(201).json(await processChatMessage(req.user, content, taskId));
});

// Newest messages first.
router.get('/chat/history', async (req, res) => {
  const skip = req.query.skip === undefined ? 0 : Number(req.query.skip);
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  if (!Number.isInteger(skip) || skip < 0) return bad(res, 'skip must be 0 or more');
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return bad(res, 'limit must be between 1 and 200');

  const filter = { user_id: req.user._id };
  const [messages, total] = await Promise.all([
    ChatMessage.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
    ChatMessage.countDocuments(filter),
  ]);
  res.json({ messages, total });
});

// ---------- Current task (focus mode) ----------

router.get('/current-task', async (req, res) => {
  const current = await CurrentTask.findOne({ user_id: req.user._id });
  if (!current) return res.status(404).json({ detail: 'No current task set' });
  res.json(current);
});

// Set, change or clear the focus task. task_id null clears it. is_active false pauses focus mode.
router.post('/current-task', async (req, res) => {
  const taskId = idOrNull(req.body.task_id);
  const contextNote = idOrNull(req.body.context_note);
  const isActive = req.body.is_active === undefined ? true : req.body.is_active;
  if (typeof isActive !== 'boolean') return bad(res, 'is_active must be true or false');
  if (contextNote !== null && (typeof contextNote !== 'string' || contextNote.length > 2000)) return bad(res, 'context_note must be at most 2000 characters');

  let task = null;
  if (taskId !== null) {
    task = mongoose.isValidObjectId(taskId) ? await Task.findOne({ _id: taskId, user_id: req.user._id }) : null;
    if (!task) return res.status(404).json({ detail: 'Task not found' });
  }

  const now = new Date();
  let current = await CurrentTask.findOne({ user_id: req.user._id });
  if (!current) {
    current = new CurrentTask({ user_id: req.user._id, started_at: isActive ? now : null });
  } else if (isActive && !current.is_active) {
    current.started_at = now; // only restart the clock when focus mode switches on again
  }
  Object.assign(current, { task_id: task?._id ?? null, context_note: contextNote, is_active: isActive, updated_at: now });
  await current.save();

  await recordActivity({
    userId: req.user._id, task, type: isActive ? 'working' : 'status_update', source: 'companion',
    taskTitle: task ? task.title : 'Current task', notes: contextNote,
    metadata: { event: 'current_task_updated', is_active: isActive },
  });
  res.json(current);
});

// ---------- Check-ins ("what are you working on?") ----------

const toDate = (v) => (v === undefined || v === null ? null : new Date(v));
const isBadDate = (d) => d !== null && isNaN(d);
const isCount = (v) => Number.isInteger(v) && v >= 0;

// The user answers a check-in (or logs a focus session by hand).
router.post('/checkin', async (req, res) => {
  const b = req.body;
  const status = b.status ?? 'idle';
  if (!PRODUCTIVITY_STATUSES.includes(status)) return bad(res, 'Invalid status');
  const startGiven = toDate(b.start_at);
  const endGiven = toDate(b.end_at);
  if (isBadDate(startGiven) || isBadDate(endGiven)) return bad(res, 'Invalid start_at or end_at');
  if (b.duration_seconds != null && !isCount(b.duration_seconds)) return bad(res, 'duration_seconds must be 0 or more');
  if (b.note != null && (typeof b.note !== 'string' || b.note.length > 1000)) return bad(res, 'note must be at most 1000 characters');
  if (b.transcript != null && (typeof b.transcript !== 'string' || b.transcript.length < 1 || b.transcript.length > 800)) return bad(res, 'transcript must be 1 to 800 characters');
  if (b.source != null && b.source !== 'voice' && b.source !== 'text') return bad(res, "source must be 'voice' or 'text'");
  if (b.task_id != null && !mongoose.isValidObjectId(b.task_id)) return bad(res, 'task_id is not valid');
  if (b.reminder_id != null && !mongoose.isValidObjectId(b.reminder_id)) return bad(res, 'reminder_id is not valid');

  let task = null;
  if (b.task_id != null) {
    task = await Task.findOne({ _id: b.task_id, user_id: req.user._id });
    if (!task) return res.status(404).json({ detail: 'Task not found' });
  }

  const now = new Date();
  let startAt = startGiven ?? now;
  let endAt = endGiven;
  let duration = b.duration_seconds ?? null;
  if (duration === null && endAt) duration = Math.max(0, Math.floor((endAt - startAt) / 1000));

  // Answering a specific check-in: the period it asked about becomes the session.
  let activityTime = now;
  if (b.reminder_id != null) {
    const reminder = await CheckinReminder.findOne({ _id: b.reminder_id, user_id: req.user._id });
    if (reminder) {
      activityTime = reminder.scheduled_time;
      if (!startGiven) startAt = new Date(reminder.scheduled_time.getTime() - 3600 * 1000);
      if (!endAt) {
        endAt = reminder.scheduled_time;
        if (duration === null) duration = 3600;
      }
    }
  }

  const note = b.transcript != null
    ? JSON.stringify({ transcript: b.transcript, timestamp: now.toISOString(), source: b.source || 'text' })
    : b.note ?? null;

  const log = await ProductivityLog.create({
    user_id: req.user._id, task_id: task?._id ?? null, status, start_at: startAt, end_at: endAt, duration_seconds: duration, note,
  });

  try {
    await linkCheckinToReminder(req.user._id, startAt, log._id, b.reminder_id);
  } catch (err) {
    console.warn('[Checkin] could not link to its reminder (the log is still saved):', err.message); // not fatal
  }

  await recordActivity({
    userId: req.user._id, task, type: 'hourly_checkin', source: 'checkin', taskTitle: task ? task.title : 'Hourly check-in',
    notes: b.transcript ?? b.note, timestamp: activityTime,
    metadata: { event: 'hourly_checkin', status, duration_seconds: duration, input_source: b.source ?? null },
  });
  res.status(201).json(log);
});

// The questions we asked. ?today=true (default)  ?status=pending|completed|missed  ?limit=50
router.get('/checkin/reminders', async (req, res) => {
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return bad(res, 'limit must be between 1 and 200');
  const { status } = req.query;
  if (status !== undefined && !REMINDER_STATUSES.includes(status)) {
    return bad(res, `Invalid status '${status}'. Must be one of: ${REMINDER_STATUSES.join(', ')}`);
  }

  const filter = { user_id: req.user._id };
  if (req.query.today !== 'false') {
    const now = new Date();
    filter.scheduled_time = { $gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) };
  }
  if (status) filter.status = status;

  res.json(await CheckinReminder.find(filter).sort({ scheduled_time: -1 }).limit(limit));
});

router.get('/checkin/reminders/:id', async (req, res) => {
  const reminder = mongoose.isValidObjectId(req.params.id)
    && (await CheckinReminder.findOne({ _id: req.params.id, user_id: req.user._id }));
  if (!reminder) return res.status(404).json({ detail: 'Reminder not found' });
  res.json(reminder);
});

router.get('/checkin/history', async (req, res) => {
  const skip = req.query.skip === undefined ? 0 : Number(req.query.skip);
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  if (!Number.isInteger(skip) || skip < 0) return bad(res, 'skip must be 0 or more');
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return bad(res, 'limit must be between 1 and 200');

  res.json(await ProductivityLog.find({ user_id: req.user._id }).sort({ start_at: -1 }).skip(skip).limit(limit));
});

// The "remind me later" button.
router.post('/checkin/reschedule', (req, res) => {
  scheduleDelayedCheckin(req.user.id, 10);
  res.status(202).json({ status: 'rescheduled' });
});

// ---------- Productivity numbers ----------

router.get('/productivity/summary', async (req, res) => {
  const days = req.query.days === undefined ? 7 : Number(req.query.days);
  if (!Number.isInteger(days) || days < 1 || days > 90) return bad(res, 'days must be between 1 and 90');

  const now = new Date();
  res.json({
    user_id: req.user.id,
    period_days: days,
    total_sessions_all_time: await ProductivityLog.countDocuments({ user_id: req.user._id }),
    mock: false,
    stats: await getTodayStats(req.user._id, now),
    generated_at: now.toISOString(),
  });
});

export default router;
