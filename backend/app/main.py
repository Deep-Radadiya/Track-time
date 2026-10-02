import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from app.api import auth, tasks, voice, devices, summary, companion
from app.api import auth, tasks, voice, devices, summary, companion, activities
from app.config import settings
from app.websocket import routes as ws_routes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app import scheduler
    from app.websocket.connection_manager import manager

    manager.loop = asyncio.get_running_loop()
    if os.getenv("DISABLE_SCHEDULER") != "1":
        scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(title="Smart Reminder", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(voice.router)
app.include_router(devices.router)
app.include_router(summary.router)
app.include_router(companion.router)
app.include_router(activities.router)
app.include_router(ws_routes.router)
# Developer tools — only available in development mode.
if settings.ENVIRONMENT == "development":
    from app.api import dev
    app.include_router(dev.router)
@app.get("/health")
async def health():
    return {"status": "ok"}
