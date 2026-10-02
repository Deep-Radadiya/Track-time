// Reads settings from the .env file and checks the important ones exist.
import 'dotenv/config';

// Pasting a key into a hosting dashboard often adds quotes, spaces, a line break or a trailing "=".
// A push key never contains those, so remove them.
const cleanKey = (value) => (value || '').trim().replace(/^["']+|["']+$/g, '').trim().replace(/=+$/, '');

for (const name of ['MONGODB_URI', 'JWT_SECRET_KEY']) {
  if (!process.env[name]) throw new Error(`Missing ${name} in .env`);
}

export const config = {
  port: process.env.PORT || 8000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET_KEY,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim().replace(/\/+$/, '')), // a website address never ends with /
  vapidPublicKey: cleanKey(process.env.VAPID_PUBLIC_KEY),
  vapidPrivateKey: cleanKey(process.env.VAPID_PRIVATE_KEY),
  vapidSubject: (process.env.VAPID_CLAIMS_SUB || 'mailto:you@example.com').trim().replace(/^["']+|["']+$/g, ''),
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  accessTokenMinutes: 30,
  refreshTokenDays: 14,
};
