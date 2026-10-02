// The "users" collection: one document per person.
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    hashed_password: { type: String, required: true },
    timezone: { type: String, default: 'UTC' },

    quiet_hours_start: { type: String, default: null }, // "HH:MM:SS"
    quiet_hours_end: { type: String, default: null },
    working_hours_start: { type: String, default: '09:00:00' },
    working_hours_end: { type: String, default: '17:00:00' },
    checkin_interval_minutes: { type: Number, default: 60 },

    daily_summary_enabled: { type: Boolean, default: true },
    reminders_enabled: { type: Boolean, default: true },
    checkin_enabled: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      // What the frontend receives: "id" instead of "_id", and never the password.
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.hashed_password;
        delete ret.createdAt;
        delete ret.updatedAt;
        return ret;
      },
    },
  }
);

export const User = mongoose.model('User', userSchema);
