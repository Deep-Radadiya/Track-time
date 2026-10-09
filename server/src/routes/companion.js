// Routes: /companion/chat, /companion/chat/history, /companion/current-task
import { Router } from 'express';
import mongoose from 'mongoose';
import { requireLogin } from '../auth.js';
import { Task } from '../models/Task.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { CurrentTask } from '../models/CurrentTask.js';
import { processChatMessage } from '../companion/chat.js';
import { recordActivity } from '../activityService.js';

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

export default router;
