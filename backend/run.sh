#!/bin/bash
# Starts the backend: one process (API + reminder scheduler).
# Needs Postgres running (e.g. brew services start postgresql@17).
cd "$(dirname "$0")"
source .venv/bin/activate
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
