# Smart Reminder Frontend SPA

A high-performance, premium client-side SPA built with React 18, TypeScript, and Vite.

## Features
- **Modern Obsidian Theme**: Deep obsidian background with electric indigo and cyan accents.
- **Simple Reminder Dashboard**: Create, edit, delete, and toggle reminders (once / hourly / daily / weekly / monthly).
- **Lunch / Break Time**: Configure a window during which reminders won't be sent.
- **Web Push Notifications**: Automatic service worker registration using standard VAPID authentication keys.
- **Single-use JWT Refresh Token rotation**: Secure memory-based access token management.

---

## Setup & Local Dev

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Ensure `VITE_API_URL` points to your backend instance (default: `http://localhost:8000`), and input your `VITE_VAPID_PUBLIC_KEY` values.

### 3. Launch Development Server
```bash
npm run dev
```
Open `http://localhost:5173` to interact with the app.
