// The "productivitylogs" collection: how focused you were during a period of time.
import mongoose from 'mongoose';

export const PRODUCTIVITY_STATUSES = ['focused', 'distracted', 'break', 'idle'];

const productivityLogSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    task_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    status: { type: String, enum: PRODUCTIVITY_STATUSES, default: 'idle' },
    start_at: { type: Date, default: Date.now },
    end_at: { type: Date, default: null },
    duration_seconds: { type: Number, default: null },
    note: { type: String, default: null, maxlength: 1000 },
  },
  {
    toJSON: {
      transform(doc, ret) {
        return {
          id: ret._id.toString(),
          user_id: ret.user_id.toString(),
          task_id: ret.task_id ? ret.task_id.toString() : null,
          status: ret.status,
          start_at: ret.start_at,
          end_at: ret.end_at,
          duration_seconds: ret.duration_seconds,
          note: ret.note,
        };
      },
    },
  }
);
productivityLogSchema.index({ user_id: 1, start_at: -1 });

export const ProductivityLog = mongoose.model('ProductivityLog', productivityLogSchema);
