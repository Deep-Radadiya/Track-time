// The "notificationlogs" collection: a record of every notification we sent.
import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema({
  task_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  device_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },
  channel: { type: String, default: 'push' },
  sent_at: { type: Date, default: Date.now },
});

export const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);
