// Step 6 of the chat: do what the AI decided. The AI only SAYS what to do. This file really does it.
import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { CurrentTask } from '../models/CurrentTask.js';
import { ProductivityLog } from '../models/ProductivityLog.js';
import { applyAction } from '../taskService.js';
import { recordActivity } from '../activityService.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Finds a task whose title contains `name` (any letter case). Finished and blocked tasks are skipped,
// except when resuming: then a blocked task is exactly what we are looking for.
const findByName = (userId, name, skip) =>
  Task.findOne({ user_id: userId, title: new RegExp(escapeRegex(name), 'i'), status: { $nin: skip } }).sort({ created_at: 1 });

// Finds the task the AI means: by exact id first, then by name.
async function findTask(userId, intent, skip = ['done', 'blocked']) {
  if (intent.task_id && mongoose.isValidObjectId(intent.task_id)) {
    const task = await Task.findOne({ _id: intent.task_id, user_id: userId });
    if (task) return task;
  }
  return intent.task_name ? findByName(userId, intent.task_name, skip) : null;
}

// Same, but if nothing matches, use the task the user is focused on right now.
async function findTaskOrFocus(userId, intent, skip) {
  const task = await findTask(userId, intent, skip);
  if (task) return task;
  const focus = await CurrentTask.findOne({ user_id: userId });
  return focus?.task_id ? Task.findOne({ _id: focus.task_id, user_id: userId }) : null;
}

const log = (user, fields) => recordActivity({ userId: user._id, source: 'companion', ...fields });

// Returns true if something was changed. Never saves the chat messages. chat.js does that.
export async function executeIntent(user, intent) {
  const now = new Date();

  switch (intent.action) {
    case 'set_current_task': {
      const task = await findTask(user._id, intent);
      const existing = await CurrentTask.findOne({ user_id: user._id });
      if (!existing) {
        await CurrentTask.create({ user_id: user._id, task_id: task?._id ?? null, is_active: true, started_at: now, updated_at: now });
      } else {
        if (!existing.is_active) existing.started_at = now; // started focusing again
        Object.assign(existing, { task_id: task?._id ?? null, is_active: true, updated_at: now });
        await existing.save();
      }
      await log(user, {
        type: 'working', taskId: task?._id ?? null, taskTitle: intent.task_name || 'Current task', notes: intent.note,
        metadata: { event: 'companion_set_current_task', action: intent.action },
      });
      return true;
    }

    case 'complete_task': {
      const task = await findTaskOrFocus(user._id, intent);
      if (!task || !applyAction(task, 'done', now)) return false;
      await task.save();
      await log(user, { type: 'completed', task, metadata: { event: 'companion_task_action', action: intent.action } });
      return true;
    }

    case 'create_task': {
      if (!intent.task_name) return false;
      const task = await Task.create({ user_id: user._id, title: intent.task_name, recurrence: 'none', status: 'pending', source: 'text' });
      await log(user, { type: 'created', task, metadata: { event: 'companion_task_action', action: intent.action } });
      return true;
    }

    case 'update_task': {
      if (!intent.task_name) return false;
      const task = await findTask(user._id, intent);
      if (!task) return false;
      task.title = intent.task_name;
      await task.save();
      await log(user, { type: 'updated', task, metadata: { event: 'companion_task_action', action: intent.action } });
      return true;
    }

    case 'block_task':
    case 'resume_task': {
      const blocking = intent.action === 'block_task';
      const task = await findTaskOrFocus(user._id, intent, blocking ? undefined : ['done']);
      if (!task || !applyAction(task, blocking ? 'block' : 'reopen', now)) return false;
      await task.save();
      await log(user, {
        type: blocking ? 'blocked' : 'resumed', task, notes: intent.note,
        metadata: { event: 'companion_task_action', action: intent.action },
      });
      return true;
    }

    case 'log_productivity': {
      const seconds = intent.duration_minutes ? intent.duration_minutes * 60 : null;
      const focus = await CurrentTask.findOne({ user_id: user._id });
      const taskId = focus?.task_id ?? null; // link it to what the user is focused on
      await ProductivityLog.create({
        user_id: user._id,
        task_id: taskId,
        status: intent.productivity_status || 'focused',
        start_at: seconds ? new Date(now.getTime() - seconds * 1000) : now,
        end_at: seconds ? now : null,
        duration_seconds: seconds,
        note: intent.note,
      });
      await log(user, {
        type: 'companion_action', taskId, taskTitle: 'Productivity log', notes: intent.note,
        metadata: { event: 'companion_productivity_log', status: intent.productivity_status || 'focused', duration_seconds: seconds },
      });
      return true;
    }

    default:
      return false; // chat_only, list_tasks, unknown: just a reply, nothing to change
  }
}
