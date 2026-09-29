# SmartReminder

SmartReminder is a simple reminder app: register, log in, create reminders
(once / hourly / daily / weekly / monthly), and get a Web Push notification
when they're due.

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: FastAPI, PostgreSQL, Redis, Celery, Alembic
- Notifications: Web Push with VAPID keys

## Project Structure

```text
backend/   FastAPI API, Celery workers, database models, migrations
frontend/  React app and service worker
```

## Required Environment

Create `backend/.env` from `backend/.env.example` and set production values:

```env
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
CELERY_BROKER_URL=redis://...
CELERY_RESULT_BACKEND=redis://...
JWT_SECRET_KEY=change-this-to-a-long-random-secret
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

```powershell
cd backend
docker compose up --build
docker compose exec backend alembic upgrade head
```

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

Backend tests:

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest tests\
```

## GitHub Deployment Notes

Do not commit `.env`, `.env.local`, `node_modules`, `dist`, virtualenvs, Celery beat files, or local notes. The root `.gitignore` is configured for those.

Before deploying, rotate any secrets that were used locally and configure them in your hosting provider's environment variable settings.
