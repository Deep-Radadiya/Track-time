from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, devices, reminders
from app.config import settings

app = FastAPI(title="Smart Reminder")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(reminders.router)
app.include_router(devices.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
