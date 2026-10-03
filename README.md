# Donezo

Donezo is a full-stack reminder and productivity check-in app.

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend (`server/`): Node.js, Express, MongoDB (one process: the API also runs the reminder scheduler)
- Notifications: Web Push with VAPID keys
- AI: Groq-backed voice parsing and productivity companion features

## Project Structure

```text
server/    Node.js API + reminder scheduler + MongoDB models (see server/README.md)
backend/   the old Python (FastAPI) version, kept only as a reference
frontend/  React app and service worker
```

## Required Environment

Create `server/.env` from `server/.env.example` and set production values:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/track_time
JWT_SECRET_KEY=change-this-to-a-long-random-secret
GROQ_API_KEY=your-groq-api-key
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_CLAIMS_SUB=mailto:you@example.com
CORS_ORIGINS=https://your-frontend-domain.example
```

Create `frontend/.env.local` from `frontend/.env.example`:

```env
VITE_API_URL=https://your-server-domain.example
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

## Local Development

Start the server and the website together:

```bash
cd frontend
npm install
cd ../server && npm install && cd ../frontend
npm run dev      # server on :8000, website on :5173
```

Only MongoDB (Atlas or local) has to be reachable. There is no Redis, worker or beat to start.

## Checks

Frontend production build:

```powershell
cd frontend
npm.cmd run build
```

The server is described in `server/README.md`.

## GitHub Deployment Notes

Do not commit `.env`, `.env.local`, `node_modules`, `dist`, virtualenvs, logs, or local notes. The root `.gitignore` is configured for those.

Before deploying, rotate any secrets that were used locally and configure them in your hosting provider's environment variable settings.
