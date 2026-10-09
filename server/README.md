# Track-time server

The backend of the app. One Node.js program (Express + MongoDB) that does everything:
answers the website, and runs the timers that send reminders. No separate worker, queue or Redis.

## Run it on your laptop

```bash
cd server
cp .env.example .env     # then fill in MONGODB_URI and JWT_SECRET_KEY
npm install
npm run dev              # http://localhost:8000
```

Or start the server and the website together from `frontend/` with `npm run dev`.
Open http://localhost:8000/health. It should show `{"status":"ok"}`.

## How it works in one minute

```
Browser  ->  routes/  ->  models/ (MongoDB)
                |
                +->  services (taskService, activityService, ...) hold the real logic

scheduler.js  ->  jobs/   (every minute: what is due? send a push notification)
```

1. The website talks to the **routes** in `src/routes/`.
2. Routes read and write MongoDB through the **models** in `src/models/`.
3. The reminder rules (when does it fire next, what does "done" or "snooze" do) are in `src/taskService.js`.
4. A **scheduler** (`src/scheduler.js`) runs inside the same program:
   every minute it sends the reminders that are due (`src/jobs/reminders.js`).

## Folder map

| File / folder | What it does |
|---|---|
| `src/index.js` | Start here: connect to MongoDB, start listening, start the scheduler |
| `src/app.js` | Builds the Express app and plugs in the routes |
| `src/config.js` | Reads `.env` |
| `src/auth.js` | Passwords, login tokens, and the "must be logged in" check |
| `src/routes/` | One file per area: auth, tasks, devices, activities, voice, companion |
| `src/models/` | What gets saved in MongoDB |
| `src/taskService.js` | Reminder logic: time windows, repeats, snooze, quiet hours |
| `src/activityService.js`, `src/intent.js` | The activity log, and reading "Blocked because ..." sentences |
| `src/push.js` | Sends Web Push notifications |
| `src/websocket.js` | Live updates: open tabs refresh by themselves |
| `src/groq.js` | The one place that talks to the AI (Groq) |
| `src/voiceService.js` | Voice-to-reminder (the AI turns a sentence into a draft reminder) |
| `src/companion/` | The AI chat (Aria): context, prompt, parseIntent, actions, chat |
| `src/scheduler.js`, `src/jobs/` | The timer and the job it runs |

## Settings (`.env`)

| Setting | What for |
|---|---|
| `MONGODB_URI` | Your MongoDB database (MongoDB Atlas) |
| `JWT_SECRET_KEY` | Signs logins. Use a long random value. |
| `CORS_ORIGINS` | Website addresses allowed to call the server, comma separated |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CLAIMS_SUB` | Web Push. The website needs the same public key. `VAPID_CLAIMS_SUB` must be `mailto:` plus a real email. |
| `GROQ_API_KEY` | AI chat and voice (optional; the rest works without it) |
| `GROQ_MODEL` | Which Groq model to use (default `llama-3.3-70b-versatile`) |
| `PORT` | Port to listen on (default 8000; hosts set this for you) |
| `DISABLE_SCHEDULER=1` | Turns the timers off (useful for tests) |

## Deploying

`render.yaml` in the repo root describes the server for Render. The server must run all day,
because the timers live inside it. On a free host that goes to sleep when idle, ping `/health`
every 5 minutes (for example with UptimeRobot) so reminders keep firing.
