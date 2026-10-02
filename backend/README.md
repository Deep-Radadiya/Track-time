# SmartReminder backend

A small web server (FastAPI + Postgres) that stores reminders, sends push notifications
when they are due, and keeps a log of the updates people write.

## Run it

```bash
./run.sh
```

Or start the whole app (backend + frontend) from `frontend/` with `npm run dev`.

`run.sh` sets everything up on the first run, applies the database tables, and starts the
server on http://localhost:8000. The only thing it needs is **Postgres**. Settings live in
`backend/.env` (copy `.env.example`). Open http://localhost:8000/docs to try every route.

Run the tests with `python -m pytest tests`.

## How it works in one minute

1. The browser talks to the **routes** in `app/api/`.
2. Routes call **services** in `app/services/` for the real logic.
3. Services read and write the database through the **models** in `app/models/`.
4. A **scheduler** (`app/scheduler.py`) runs inside the same server. Every minute it runs
   the **jobs** in `app/jobs/`: find reminders that are due and send a push notification.

```
Browser  ->  api/ (routes)  ->  services/ (logic)  ->  models/ (database tables)
                                      ^
scheduler.py  ->  jobs/ (every minute: what is due? send push)
```

There is no separate worker, queue or Redis. One process does everything.

## Folder map

| Folder / file | What is in it |
|---|---|
| `app/main.py` | Starts the app and registers the routes |
| `app/config.py` | Settings read from `.env` |
| `app/database.py` | Database connections |
| `app/scheduler.py` | Runs the jobs on a timer |
| `app/api/` | Routes. One file per area: `auth`, `tasks`, `activities`, `devices`, `summary`, `voice`, `companion` |
| `app/services/` | The logic behind the routes (see below) |
| `app/models/` | Database tables |
| `app/schemas/` | The shape of data going in and out of the routes |
| `app/jobs/` | Jobs run by the scheduler |
| `app/websocket/` | Live updates to open browser tabs |
| `app/core/` | Login helpers (password hashing, tokens) |
| `alembic/versions/` | Database changes, one file per change |
| `tests/` | Automated tests |

## The main ideas

**Reminders (tasks).** A reminder is a row in the `tasks` table (`app/models/task.py`).
The important field is `next_due_at`: the next moment it should fire. A reminder can
have a daily time window (`window_start` to `window_end`), an interval (`interval_minutes`)
and a lunch break (`lunch_start` to `lunch_end`). `next_window_slot` in
`app/services/task_service.py` works out the next time it should fire inside the window,
skipping lunch.

**Sending notifications.** Every minute, `app/jobs/reminder_tasks.py` finds reminders whose
`next_due_at` has passed, sends a Web Push to the user's browsers
(`app/services/push_service.py`), then moves `next_due_at` to the next slot.
Browsers that allowed notifications are saved in the `devices` table.

**Updates.** When someone writes an update about a reminder, the route in
`app/api/activities.py` saves it in the `reminder_activities` table. The raw text is kept
in the `metadata` column.

**Login.** `app/api/auth.py`. Passwords are hashed. After login the browser gets a short
access token and a longer refresh token. A refresh token can be used once; used or
logged-out tokens are stored in the `revoked_tokens` table.

**AI features (optional).** They need a Groq or OpenAI key in `.env`. Without a key the
rest of the app still works.
- `app/api/voice.py` and `services/voice_service.py`: turn a spoken sentence into a reminder.
- `app/api/companion.py` and `services/companion/`: the chat assistant. `chat_service.py`
  runs the flow, `prompt_builder.py` builds the instructions for the AI, `intent_parser.py`
  reads its answer, and `task_actions.py` applies it to your reminders.
- `app/jobs/summary_tasks.py` and `services/summary_service.py`: the daily recap at 9 PM
  in each user's own time zone.
- `app/jobs/checkin_tasks.py`: asks "what are you working on?" during working hours.

## Common changes

**Add a field to reminders**
1. Add the column in `app/models/task.py`.
2. Add the field in `app/schemas/task.py`.
3. Create a migration in `alembic/versions/` (copy the latest file as a template) and run
   `alembic upgrade head`.
4. Use the field in `app/api/tasks.py`.

**Add a new scheduled job**
1. Write the function in `app/jobs/`.
2. Register it in `app/scheduler.py`.

## Keys you need

| Setting in `.env` | What for |
|---|---|
| `DATABASE_URL` | Your Postgres database |
| `JWT_SECRET_KEY` | Signs logins. Use a long random value. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push. The frontend needs the same public key. |
| `CORS_ORIGINS` | Website addresses allowed to call the API |
| `GROQ_API_KEY` | AI chat and summaries (optional) |
| `OPENAI_API_KEY` | Voice parsing (optional) |
