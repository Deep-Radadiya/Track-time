#!/bin/bash
# Starts the backend: one process (API + reminder scheduler).
# First run sets up the Python environment by itself.
cd "$(dirname "$0")" || exit 1

# 1. Python environment
if [ ! -d .venv ]; then
  echo "[backend] First run: creating Python environment (takes a minute)..."
  python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt || exit 1
fi
source .venv/bin/activate

# 2. Settings file
if [ ! -f .env ]; then
  cp .env.example .env
  echo "[backend] Created backend/.env from .env.example - add your keys there."
fi

# 3. Postgres (start it if it is installed with Homebrew but not running)
if ! pg_isready -q 2>/dev/null; then
  PG=$(brew services list 2>/dev/null | awk '/^postgresql/ {print $1; exit}')
  if [ -n "$PG" ]; then
    echo "[backend] Starting Postgres ($PG)..."
    brew services start "$PG" >/dev/null
    for _ in $(seq 1 20); do pg_isready -q 2>/dev/null && break; sleep 1; done
  fi
fi
pg_isready -q 2>/dev/null || { echo "[backend] Postgres is not running. Install/start it (brew install postgresql@17)."; exit 1; }

# 4. Database tables, then the server
alembic upgrade head || exit 1
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
