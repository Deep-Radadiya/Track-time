// The "currenttasks" collection: what each user is focused on right now. One document per user.
import mongoose from 'mongoose';

const currentTaskSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    task_id: { type: mongoose.Schema.Types.ObjectId, default: null }, // null = no task chosen
    context_note: { type: String, default: null, maxlength: 2000 },
    is_active: { type: Boolean, default: false },
    started_at: { type: Date, default: null },
    updated_at: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform(doc, ret) {
        return {
          user_id: ret.user_id.toString(),
          task_id: ret.task_id ? ret.task_id.toString() : null,
          context_note: ret.context_note,
          is_active: ret.is_active,
          started_at: ret.started_at,
          updated_at: ret.updated_at,
        };
      },
    },
  }
);

export const CurrentTask = mongoose.model('CurrentTask', currentTaskSchema);
