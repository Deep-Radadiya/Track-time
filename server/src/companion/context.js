// Step 2 of the chat: collect everything the AI should know about the user right now.
// It returns plain objects, so the prompt can use them freely.
import { Task } from '../models/Task.js';
import { CurrentTask } from '../models/CurrentTask.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { ProductivityLog } from '../models/ProductivityLog.js';

const HISTORY_WINDOW = 10; // how many recent chat messages the AI remembers

const snapshot = (task) => ({
  id: task.id,
  title: task.title,
  status: task.status,
  due_at: task.due_at ? task.due_at.toISOString() : null,
  category: task.category,
});

export async function buildContext(user) {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // The task the user is focused on right now.
  let currentTask = null;
  const focus = await CurrentTask.findOne({ user_id: user._id });
  if (focus?.task_id) {
    const task = await Task.findOne({ _id: focus.task_id, user_id: user._id });
    if (task) currentTask = snapshot(task);
  }

  // Not done yet. Earliest due first; tasks with no due time come first.
  const pending = await Task.find({ user_id: user._id, status: { $ne: 'done' } }).sort({ due_at: 1 }).limit(20);

  const completedToday = await Task.find({ user_id: user._id, status: 'done', updated_at: { $gte: todayStart } })
    .sort({ updated_at: -1 })
    .limit(10);

  // The last messages, oldest first, so the AI reads them in order.
  const chat = await ChatMessage.find({ user_id: user._id, role: { $in: ['user', 'assistant'] } })
    .sort({ created_at: -1 })
    .limit(HISTORY_WINDOW);

  const logs = await ProductivityLog.find({ user_id: user._id, start_at: { $gte: todayStart } }).sort({ start_at: 1 });

  return {
    user_id: user.id,
    user_email: user.email,
    now_utc: now.toISOString(),
    current_task: currentTask,
    pending_tasks: pending.map(snapshot),
    completed_today: completedToday.map(snapshot),
    recent_chat: chat.reverse().map((m) => ({ role: m.role, content: m.content })),
    productivity_logs_today: logs.map((l) => ({
      status: l.status,
      start_at: l.start_at.toISOString(),
      duration_seconds: l.duration_seconds,
      note: l.note,
    })),
  };
}
