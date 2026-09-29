# SmartReminder Backend

FastAPI + Postgres + Celery backend for a simple, multi-device reminder app.
Backend only — no AI/voice/analytics features, no frontend included.

## Stack
FastAPI (async) · PostgreSQL via async SQLAlchemy 2.0 + asyncpg · Alembic ·
JWT auth (python-jose + passlib) · Celery + Celery beat on Redis · pywebpush ·
docker-compose for local dev.

## Quick start

1. Copy `.env.example` to `.env` and fill in real values — at minimum
   `JWT_SECRET_KEY` and `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (generate
   with `npx web-push generate-vapid-keys`).
2. `docker compose up --build`
3. Visit `http://localhost:8000/docs` for interactive Swagger UI; `/health`
   should return `{"status": "ok"}`.
4. Run migrations (first time / after model changes):
   `docker compose exec backend alembic upgrade head`
5. Run tests: `docker compose exec backend pytest -v`

## Project layout

```
app/
  main.py            FastAPI app + route registration, /health
  config.py          pydantic-settings, reads .env
  database.py         async engine + session factory
  models/             SQLAlchemy: user, reminder, device, notification_log
  schemas/             Pydantic request/response schemas
  api/                route handlers (auth, reminders, devices)
  services/            business logic, separate from routes:
                          auth_service, reminder_service (due-time math),
                          push_service
  workers/             celery_app.py, reminder_tasks.py (the beat job)
  core/                security.py (JWT/password hashing), deps.py (auth dep)
alembic/               migrations (one squashed initial migration)
tests/                 pytest: reminder scheduling unit tests + API tests
```

## Design decisions (so you can defend them)

**Why scheduling is server-driven (Celery beat), not client timers.**
A `setTimeout`/JS-interval-based reminder dies the instant a tab closes, a
phone goes to sleep, or the OS kills the background app — exactly the
moments a reminder app most needs to still work. Celery beat runs as an
independent process on the server, completely decoupled from whether any
client is even open, so "what's due right now" has one single source of
truth and one clock.

**Why reminder time-of-day is compared in the user's local timezone.**
`reminder.time` / `day_of_week` / `day_of_month` are naive values meaning
the user's local wall-clock time. The beat job (`reminder_tasks.py`)
converts `now()` (UTC) to the user's IANA timezone via `zoneinfo` before
ever comparing against a reminder's configured time — so "9am" always means
9am for that user, regardless of server timezone.

**Guarding against duplicate sends.** Each reminder tracks `last_fired_at`.
`reminder_service.is_due_now()` won't fire a reminder again within its
matching window (same hour for hourly, same calendar day for
daily/weekly/monthly, ever-once for a one-time reminder) even if the beat
tick runs more than once inside that window.

**Lunch/break period.** `User.lunch_start` / `lunch_end` define a local-time
window during which due reminders are simply skipped for that tick — no
rescheduling. If unset, reminders behave normally.

## Notes / things to wire up for production

- VAPID keys are required for real push delivery; without them
  `pywebpush` calls will fail (this is expected and harmless in dev/testing
  without a real subscriber).
- `NotificationLog` is a minimal send-audit table (reminder_id, device_id,
  sent_at, channel) — there's no read/ack tracking since the MVP has no
  in-app notification inbox.
