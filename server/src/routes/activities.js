// Routes: GET /activities (the log) and POST /activities/submit (write an update).
import { Router } from 'express';
import mongoose from 'mongoose';
import { Activity, ACTIVITY_TYPES, ACTIVITY_SOURCES } from '../models/Activity.js';
import { Task } from '../models/Task.js';
import { requireLogin } from '../auth.js';
import { extractIntent } from '../intent.js';
import { recordActivity, localDateString, dayBounds } from '../activityService.js';

const router = Router();
router.use(requireLogin);

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

// The user writes (or speaks) an update like "Blocked because Docker won't start".
router.post('/submit', async (req, res) => {
  const { text, source, task_id } = req.body;
  if (typeof text !== 'string' || text.trim().length < 1 || text.length > 2000) return bad(res, 'text must be 1 to 2000 characters');
  if (source !== 'voice' && source !== 'text') return bad(res, "source must be 'voice' or 'text'");

  const intent = extractIntent(text);
  let type = intent.activity_type;
  if (type === 'status_update') type = source === 'voice' ? 'voice_update' : 'text_update';

  // Only link the task if it really is this user's.
  let taskId = null;
  if (task_id && mongoose.isValidObjectId(task_id)) {
    const task = await Task.findOne({ _id: task_id, user_id: req.user._id });
    taskId = task ? task._id : null;
  }

  const activity = await recordActivity({
    userId: req.user._id,
    taskId,
    type,
    taskTitle: intent.task_title,
    notes: intent.optional_notes,
    source,
    metadata: { event: 'reminder_response', raw_text: text },
  });
  res.status(201).json(activity);
});

export default router;
