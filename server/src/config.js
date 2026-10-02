// Reads settings from the .env file and checks the important ones exist.
import 'dotenv/config';

// Pasting a key into a hosting dashboard often adds extras: quotes, a trailing "=", the name ("VAPID_PRIVATE_KEY=..."),
// or the NEXT line of the .env file. A push key is one single word, so keep only the first word and clean it.
// Some tools also write "+" and "/" where push keys use "-" and "_", so convert those too.
const stripQuotes = (v) => v.replace(/^["']+|["']+$/g, '');
const cleanKey = (value) =>
  stripQuotes(stripQuotes((value || '').trim()).split(/\s+/)[0].replace(/^VAPID_[A-Z_]*KEY\s*=/i, ''))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

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
