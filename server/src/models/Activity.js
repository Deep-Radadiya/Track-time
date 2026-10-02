// The "activities" collection: a log of what happened (created, started, completed, your written updates...).
import mongoose from 'mongoose';

export const ACTIVITY_TYPES = [
  'created', 'started', 'working', 'updated', 'completed', 'blocked', 'resumed', 'snoozed', 'deleted',
  'reminder_response', 'hourly_checkin', 'voice_update', 'text_update', 'companion_action', 'status_update',
];
export const ACTIVITY_SOURCES = ['voice', 'text', 'task', 'reminder', 'checkin', 'companion', 'system'];

const activitySchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Kept even after the task is deleted, so the history survives.
    task_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    activity_type: { type: String, enum: ACTIVITY_TYPES, required: true },
    task_title: { type: String, required: true, maxlength: 500 },
    optional_notes: { type: String, default: null, maxlength: 1000 },
    source: { type: String, enum: ACTIVITY_SOURCES, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        ret.user_id = ret.user_id.toString();
        ret.task_id = ret.task_id ? ret.task_id.toString() : null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);
activitySchema.index({ user_id: 1, timestamp: -1 });

export const Activity = mongoose.model('Activity', activitySchema);
