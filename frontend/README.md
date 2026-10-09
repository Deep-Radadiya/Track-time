# Donezo website

The React + TypeScript + Vite frontend. The full guide (features, setup, environment variables)
is in the [root README](../README.md).

## Quick start

```bash
npm install
cp .env.example .env.local   # set VITE_API_URL and VITE_VAPID_PUBLIC_KEY
npm run dev                  # starts ../server too; open http://localhost:5173
```

Use `npm run dev:web` to start only the website, `npm run build` to type-check and build,
and `npm run lint` to check the code.

## Where things are

| Folder | What it holds |
|---|---|
| `src/pages/` | One component per page. Routes are listed in `src/App.tsx`. |
| `src/components/` | UI pieces. `tasks/ReminderForm.tsx` is the form shared by the create and edit popups. |
| `src/hooks/` | Data and app logic: `useTasks`, `useActivities`, `useAuth`, `useWebSocket`, `useTokenRefresh` |
| `src/api/` | Calls to the server. `axios.ts` adds the login token and refreshes it on a 401. |
| `src/stores/` | Small global state with Zustand (login, device id, WebSocket status) |
| `src/lib/` | Helpers, and `sw-registration.ts` which turns on push notifications |
| `public/sw.js` | Service worker: shows notifications and handles the Done / Snooze buttons |
