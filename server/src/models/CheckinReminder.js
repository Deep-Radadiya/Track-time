// The "checkinreminders" collection: one document for each "what are you working on?" question we asked.
import mongoose from 'mongoose';

export const REMINDER_STATUSES = ['pending', 'completed', 'missed'];

const checkinReminderSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scheduled_time: { type: Date, required: true }, // the start of the period this question is about
    status: { type: String, enum: REMINDER_STATUSES, default: 'pending' },
    response_id: { type: mongoose.Schema.Types.ObjectId, default: null }, // the productivity log that answered it
    created_at: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform(doc, ret) {
        return {
          id: ret._id.toString(),
          user_id: ret.user_id.toString(),
          scheduled_time: ret.scheduled_time,
          status: ret.status,
          response_id: ret.response_id ? ret.response_id.toString() : null,
          created_at: ret.created_at,
        };
      },
    },
  }
);
// A user can have only one question per period. This also stops duplicates if two runs overlap.
checkinReminderSchema.index({ user_id: 1, scheduled_time: 1 }, { unique: true });

export const CheckinReminder = mongoose.model('CheckinReminder', checkinReminderSchema);
