// The "reminder_logs" collection: one document for every reminder that was sent.
// It is how we know which reminders the user did not answer (shown as "Missed").
import mongoose from 'mongoose';

const reminderLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  task_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  task_title: { type: String, required: true, maxlength: 500 },
  // The time the reminder was due. An update written for this reminder is saved at this same time.
  due_at: { type: Date, required: true },
});

// One document per reminder time of a task, even if the job runs twice.
reminderLogSchema.index({ task_id: 1, due_at: 1 }, { unique: true });
reminderLogSchema.index({ user_id: 1, due_at: -1 });

export const ReminderLog = mongoose.model('ReminderLog', reminderLogSchema);
