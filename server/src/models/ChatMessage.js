// The "chatmessages" collection: every message you and the AI assistant (Aria) exchanged.
import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    task_id: { type: mongoose.Schema.Types.ObjectId, default: null }, // the task this message was about, if any
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    token_count: { type: Number, default: null },
    created_at: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform(doc, ret) {
        return {
          id: ret._id.toString(),
          user_id: ret.user_id.toString(),
          task_id: ret.task_id ? ret.task_id.toString() : null,
          role: ret.role,
          content: ret.content,
          token_count: ret.token_count,
          created_at: ret.created_at,
        };
      },
    },
  }
);
chatMessageSchema.index({ user_id: 1, created_at: -1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
