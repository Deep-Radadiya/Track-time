# SmartReminder

SmartReminder is a full-stack reminder and productivity check-in app.

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: FastAPI, PostgreSQL, Alembic (one process: the API also runs the reminder scheduler)
- Notifications: Web Push with VAPID keys
- AI: Groq-backed voice parsing and productivity companion features

## Project Structure

```text
backend/   FastAPI API + reminder scheduler, database models, migrations
frontend/  React app and service worker
```

## Required Environment

Create `backend/.env` from `backend/.env.example` and set production values:

```env
DATABASE_URL=postgresql+asyncpg://...
JWT_SECRET_KEY=change-this-to-a-long-random-secret
GROQ_API_KEY=your-groq-api-key
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_CLAIMS_SUB=mailto:you@example.com
CORS_ORIGINS=https://your-frontend-domain.example
ENVIRONMENT=production
```

Create `frontend/.env.local` from `frontend/.env.example`:

```env
VITE_API_URL=https://your-backend-domain.example
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

## Local Development

Backend:

```bash
cd backend
./run.sh        # applies migrations and starts the API + scheduler on :8000
```

Only Postgres has to be running. There is no Redis, worker or beat to start.

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Checks

Frontend production build:

```powershell
cd frontend
npm.cmd run build
```

Backend focused test:

```powershell
cd backend
$env:DATABASE_URL='sqlite+aiosqlite:///dummy.db'
$env:TEST_DATABASE_URL='sqlite+aiosqlite:///test.db'
$env:JWT_SECRET_KEY='dev-only'
$env:GROQ_API_KEY='dev-only'
.\venv\Scripts\python.exe -m pytest tests\test_checkin_service.py
```

## GitHub Deployment Notes

Do not commit `.env`, `.env.local`, `node_modules`, `dist`, virtualenvs, logs, or local notes. The root `.gitignore` is configured for those.

Before deploying, rotate any secrets that were used locally and configure them in your hosting provider's environment variable settings.
