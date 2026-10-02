// Reads settings from the .env file and checks the important ones exist.
import 'dotenv/config';

for (const name of ['MONGODB_URI', 'JWT_SECRET_KEY']) {
  if (!process.env[name]) throw new Error(`Missing ${name} in .env`);
}

export const config = {
  port: process.env.PORT || 8000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET_KEY,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
  vapidSubject: process.env.VAPID_CLAIMS_SUB || 'mailto:you@example.com',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  accessTokenMinutes: 30,
  refreshTokenDays: 14,
};
