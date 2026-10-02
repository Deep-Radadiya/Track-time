// The "devices" collection: one document per browser/phone that allowed notifications.
import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The browser's push address, saved as JSON text. We send notifications to it.
    push_token: { type: String, required: true },
    // The address part of push_token. The same browser always has the same one, so we use it to spot duplicates.
    endpoint: { type: String, required: true },
    is_primary: { type: Boolean, default: false },
    last_active_at: { type: Date, default: Date.now },
    push_enabled: { type: Boolean, default: true },
  },
  {
    toJSON: {
      // What the frontend receives. The push address stays private on the server.
      transform(doc, ret) {
        return {
          id: ret._id.toString(),
          is_primary: ret.is_primary,
          last_active_at: ret.last_active_at,
          push_enabled: ret.push_enabled,
        };
      },
    },
  }
);

// One browser can only be saved once per user. The database enforces this, even if two requests arrive at the same moment.
deviceSchema.index({ user_id: 1, endpoint: 1 }, { unique: true });

export const Device = mongoose.model('Device', deviceSchema);
