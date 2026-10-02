// Routes: /auth/signup, /login, /refresh, /logout, /me
import { Router } from 'express';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { RevokedToken } from '../models/RevokedToken.js';
import {
  hashPassword, checkPassword, createAccessToken, createRefreshToken,
  readToken, hashToken, requireLogin,
} from '../auth.js';

const router = Router();

const tokensFor = (user) => ({
  access_token: createAccessToken(user._id),
  refresh_token: createRefreshToken(user._id),
  token_type: 'bearer',
});

// Remember a refresh token as used, so it cannot be used a second time.
async function revoke(token) {
  const expires_at = new Date(Date.now() + config.refreshTokenDays * 86400 * 1000);
  await RevokedToken.updateOne({ token_hash: hashToken(token) }, { expires_at }, { upsert: true });
}

router.post('/signup', async (req, res) => {
  const { email, password, timezone } = req.body;
  if (!email || !email.includes('@')) return res.status(422).json({ detail: 'Valid email is required' });
  if (!password || password.length < 8) return res.status(422).json({ detail: 'Password must be at least 8 characters' });

  if (await User.findOne({ email })) return res.status(400).json({ detail: 'Email already registered' });

  const user = await User.create({
    email,
    hashed_password: await hashPassword(password),
    timezone: timezone || 'UTC',
  });
  res.status(201).json(tokensFor(user));
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = email && (await User.findOne({ email }));
  if (!user || !(await checkPassword(password || '', user.hashed_password))) {
    return res.status(401).json({ detail: 'Invalid email or password' });
  }
  res.json(tokensFor(user));
});

router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(422).json({ detail: 'refresh_token is required' });

  if (await RevokedToken.exists({ token_hash: hashToken(refresh_token) })) {
    return res.status(401).json({ detail: 'Refresh token has been revoked' });
  }
  try {
    const data = readToken(refresh_token);
    if (data.type !== 'refresh') throw new Error('not a refresh token');
    await revoke(refresh_token); // each refresh token works only once
    res.json({
      access_token: createAccessToken(data.sub),
      refresh_token: createRefreshToken(data.sub),
      token_type: 'bearer',
    });
  } catch {
    res.status(401).json({ detail: 'Invalid refresh token' });
  }
});

router.post('/logout', async (req, res) => {
  if (req.body.refresh_token) await revoke(req.body.refresh_token);
  res.status(204).end();
});

router.get('/me', requireLogin, (req, res) => res.json(req.user));

// Only these settings can be changed by the user.
const EDITABLE = [
  'working_hours_start', 'working_hours_end', 'checkin_interval_minutes',
  'daily_summary_enabled', 'reminders_enabled', 'checkin_enabled', 'timezone',
];

router.patch('/me', requireLogin, async (req, res) => {
  for (const field of EDITABLE) {
    if (req.body[field] !== undefined) req.user[field] = req.body[field];
  }
  await req.user.save();
  res.json(req.user);
});

export default router;
