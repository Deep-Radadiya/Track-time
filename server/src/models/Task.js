// The "tasks" collection: one document per reminder.
import mongoose from 'mongoose';

export const STATUSES = ['pending', 'in_progress', 'done', 'snoozed', 'blocked'];
export const RECURRENCES = ['none', 'interval', 'daily', 'weekly'];
export const SOURCES = ['voice', 'text'];

// A small checklist item inside a task. It is stored inside the task document itself.
const noteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  done: { type: Boolean, default: false },
  order_index: { type: Number, default: 0 },
});

const taskSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 500 },
    status: { type: String, enum: STATUSES, default: 'pending' },
    recurrence: { type: String, enum: RECURRENCES, default: 'none' },

    due_at: { type: Date, default: null },
    // The original first due time. Repeats are always counted from here, so they never drift.
    anchor_time: { type: Date, default: null },
    interval_minutes: { type: Number, default: null },

    // Daily time window ("HH:MM:SS" in the user's local time). Reminders repeat inside it, skipping lunch.
    window_start: { type: String, default: null },
    window_end: { type: String, default: null },
    lunch_start: { type: String, default: null },
    lunch_end: { type: String, default: null },

    // The next moment this reminder should fire. The scheduler looks at this field.
    next_due_at: { type: Date, default: null, index: true },
    snoozed_until: { type: Date, default: null },
    snoozed_count_today: { type: Number, default: 0 },
    snoozed_count_total: { type: Number, default: 0 },

    category: { type: String, default: null, maxlength: 100 },
    source: { type: String, enum: SOURCES, default: 'text' },

    // Time of the last action applied. Older or repeated actions are ignored.
    last_action_client_ts: { type: Date, default: null },

    notes: [noteSchema],
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      // What the frontend receives: "id" instead of "_id".
      transform(doc, ret) {
        ret.id = ret._id.toString();
        ret.user_id = ret.user_id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.last_action_client_ts;
        ret.notes = (ret.notes || []).map((n) => ({
          id: n._id.toString(), text: n.text, done: n.done, order_index: n.order_index,
        }));
        return ret;
      },
    },
  }
);

export const Task = mongoose.model('Task', taskSchema);
