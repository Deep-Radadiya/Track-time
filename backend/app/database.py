"""Database connections: an async one for API requests and a sync one for the background jobs."""
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from app.config import settings


class Base(DeclarativeBase):
    pass


# Async engine — used by FastAPI endpoints
# asyncpg wants ?ssl=require, psycopg2 wants ?sslmode=require (Neon gives sslmode)
async_url = settings.DATABASE_URL.replace("sslmode=", "ssl=")
engine = create_async_engine(async_url, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# Sync engine — used by the scheduler jobs (they run in a background thread, outside the event loop)
# Converts postgresql+asyncpg:// -> postgresql+psycopg2://
_sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
sync_engine = create_engine(_sync_url, pool_pre_ping=True)
SyncSessionLocal = sessionmaker(bind=sync_engine, expire_on_commit=False)
