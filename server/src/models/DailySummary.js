// The "dailysummaries" collection: one AI-written recap per user per day.
import mongoose from 'mongoose';

const dailySummarySchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // the user's local date, "YYYY-MM-DD"
    content: { type: mongoose.Schema.Types.Mixed, required: true }, // { summary, highlight, concern, tomorrow_suggestion }
    created_at: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform(doc, ret) {
        return { id: ret._id.toString(), user_id: ret.user_id.toString(), date: ret.date, content: ret.content, created_at: ret.created_at };
      },
    },
  }
);
dailySummarySchema.index({ user_id: 1, date: 1 }, { unique: true }); // one summary per user per day

export const DailySummary = mongoose.model('DailySummary', dailySummarySchema);
