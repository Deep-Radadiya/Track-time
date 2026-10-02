// Everything about passwords and login tokens, in one place.
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { User } from './models/User.js';

export const hashPassword = (password) => bcrypt.hash(password, 10);
export const checkPassword = (password, hash) => bcrypt.compare(password, hash);

// Tokens are signed text that says who you are. "type" tells what the token is for.
function makeToken(userId, type, expiresIn) {
  return jwt.sign({ sub: String(userId), type }, config.jwtSecret, { expiresIn });
}
export const createAccessToken = (id) => makeToken(id, 'access', config.accessTokenMinutes * 60);
export const createRefreshToken = (id) => makeToken(id, 'refresh', config.refreshTokenDays * 86400);
export const createActionToken = (id) => makeToken(id, 'action', 7 * 86400); // used by notification buttons

export const readToken = (token) => jwt.verify(token, config.jwtSecret); // throws if invalid or expired
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Middleware: put it on any route that needs a logged-in user. It sets req.user.
export async function requireLogin(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const data = readToken(token);
    if (data.type !== 'access' && data.type !== 'action') throw new Error('wrong token type');
    const user = await User.findById(data.sub);
    if (!user) throw new Error('user not found');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ detail: 'Could not validate credentials' });
  }
}
