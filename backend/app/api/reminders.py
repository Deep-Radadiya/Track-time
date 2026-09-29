from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Reminder, User
from app.schemas.reminder import ReminderCreate, ReminderOut, ReminderUpdate
from app.services import reminder_service

router = APIRouter(tags=["reminders"])


@router.post("/reminders", response_model=ReminderOut, status_code=201)
async def create_reminder(payload: ReminderCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    reminder = Reminder(user_id=user.id, **payload.model_dump())
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


@router.get("/reminders", response_model=list[ReminderOut])
async def list_reminders(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Reminder).where(Reminder.user_id == user.id).order_by(Reminder.created_at.desc()))
    return list(result.scalars().all())


@router.put("/reminders/{reminder_id}", response_model=ReminderOut)
async def update_reminder(reminder_id: UUID, payload: ReminderUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    reminder = await reminder_service.get_reminder_for_user(db, reminder_id, user.id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(reminder, field, value)
    await db.commit()
    await db.refresh(reminder)
    return reminder


@router.delete("/reminders/{reminder_id}", status_code=204)
async def delete_reminder(reminder_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    reminder = await reminder_service.get_reminder_for_user(db, reminder_id, user.id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    await db.delete(reminder)
    await db.commit()
