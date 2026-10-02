// Routes: register a browser for push notifications, and send a test push.
import { Router } from 'express';
import mongoose from 'mongoose';
import { Device } from '../models/Device.js';
import { requireLogin } from '../auth.js';
import { sendPush, GoneError } from '../push.js';

const router = Router();
router.use(requireLogin);

// Register this browser. If the same browser is already saved, just update it.
router.post('/', async (req, res) => {
  const { push_token, is_primary } = req.body;

  let endpoint;
  try {
    endpoint = JSON.parse(push_token).endpoint;
  } catch {
    return res.status(422).json({ detail: 'push_token must be valid JSON PushSubscription' });
  }
  if (!endpoint) return res.status(422).json({ detail: "push_token JSON must contain an 'endpoint' field" });

  // Same browser = same endpoint. One atomic "update it, or create it" step, so two requests
  // arriving at the same moment cannot create two devices.
  const changes = { push_token, last_active_at: new Date(), ...(is_primary !== undefined && { is_primary: !!is_primary }) };
  const find = { user_id: req.user._id, endpoint };
  let device;
  try {
    device = await Device.findOneAndUpdate(find, changes, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
  } catch (err) {
    if (err.code !== 11000) throw err;
    // The other request created it first. Just update that one.
    device = await Device.findOneAndUpdate(find, changes, { returnDocument: 'after' });
  }
  res.status(201).json(device);
});

router.get('/', async (req, res) => {
  res.json(await Device.find({ user_id: req.user._id }));
});

// The frontend calls this every few minutes to show the device is still in use.
router.post('/:id/ping', async (req, res) => {
  const device = mongoose.isValidObjectId(req.params.id)
    && (await Device.findOne({ _id: req.params.id, user_id: req.user._id }));
  if (!device) return res.status(404).json({ detail: 'Device not found' });

  device.last_active_at = new Date();
  await device.save();
  res.json(device);
});

// Sends a test notification to every device of the logged-in user.
router.post('/test-push', async (req, res) => {
  const devices = await Device.find({ user_id: req.user._id });
  if (devices.length === 0) return res.json({ status: 'no_devices', devices_targeted: 0, results: [] });

  const payload = {
    title: 'SmartReminder Test',
    body: 'Your push notifications are configured correctly!',
    type: 'test',
    tag: 'test-push',
  };

  const results = [];
  for (const device of devices) {
    const id = device.id;
    try {
      const sent = await sendPush(device.push_token, payload);
      results.push(sent ? { device_id: id, status: 'sent' } : { device_id: id, status: 'failed' });
    } catch (err) {
      if (err instanceof GoneError) {
        await device.deleteOne(); // the browser unsubscribed, so forget it
        results.push({ device_id: id, status: 'removed', error: 'Subscription expired' });
      } else {
        results.push({ device_id: id, status: 'failed', error: err.message });
      }
    }
  }
  res.json({ status: 'ok', devices_targeted: devices.length, results });
});

export default router;
