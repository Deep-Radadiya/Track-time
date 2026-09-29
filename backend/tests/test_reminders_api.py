"""
Integration tests for the reminders API: CRUD + user isolation.
Runs against TEST_DATABASE_URL, creating/dropping tables per test module.
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.database import Base
from app.main import app
from app import database as db_module

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture(autouse=True)
async def _setup_db():
    # A fresh engine per test avoids reusing asyncpg connections across the
    # separate event loops pytest-asyncio spins up per test function.
    test_engine = create_async_engine(settings.TEST_DATABASE_URL, future=True, poolclass=NullPool)
    TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)

    async def override_get_db():
        async with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[db_module.get_db] = override_get_db

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _signup_and_login(client: AsyncClient, email: str) -> str:
    resp = await client.post("/auth/signup", json={"email": email, "password": "password123"})
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_create_and_list_reminder(client: AsyncClient):
    token = await _signup_and_login(client, "user1@example.com")
    resp = await client.post(
        "/reminders",
        json={"title": "Drink water", "repeat_type": "daily", "time": "09:00:00"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201, resp.text
    reminder = resp.json()
    assert reminder["title"] == "Drink water"
    assert reminder["is_active"] is True

    resp = await client.get("/reminders", headers=_auth_headers(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_update_and_delete_reminder(client: AsyncClient):
    token = await _signup_and_login(client, "user2@example.com")
    create_resp = await client.post(
        "/reminders",
        json={"title": "Stretch", "repeat_type": "hourly", "active_start": "09:00:00", "active_end": "18:00:00"},
        headers=_auth_headers(token),
    )
    reminder_id = create_resp.json()["id"]

    resp = await client.put(
        f"/reminders/{reminder_id}",
        json={
            "title": "Stretch",
            "repeat_type": "hourly",
            "active_start": "09:00:00",
            "active_end": "18:00:00",
            "is_active": False,
        },
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    resp = await client.delete(f"/reminders/{reminder_id}", headers=_auth_headers(token))
    assert resp.status_code == 204

    resp = await client.get("/reminders", headers=_auth_headers(token))
    assert resp.json() == []


async def test_user_cannot_see_edit_or_delete_another_users_reminder(client: AsyncClient):
    token_a = await _signup_and_login(client, "usera@example.com")
    token_b = await _signup_and_login(client, "userb@example.com")

    create_resp = await client.post(
        "/reminders",
        json={"title": "A's reminder", "repeat_type": "hourly", "active_start": "09:00:00", "active_end": "18:00:00"},
        headers=_auth_headers(token_a),
    )
    reminder_id = create_resp.json()["id"]

    # B cannot see A's reminder in their list.
    resp = await client.get("/reminders", headers=_auth_headers(token_b))
    assert resp.json() == []

    # B cannot edit A's reminder.
    resp = await client.put(
        f"/reminders/{reminder_id}",
        json={"title": "hijacked", "repeat_type": "hourly", "active_start": "09:00:00", "active_end": "18:00:00"},
        headers=_auth_headers(token_b),
    )
    assert resp.status_code == 404

    # B cannot delete A's reminder.
    resp = await client.delete(f"/reminders/{reminder_id}", headers=_auth_headers(token_b))
    assert resp.status_code == 404

    # A can still see and manage it.
    resp = await client.get("/reminders", headers=_auth_headers(token_a))
    assert len(resp.json()) == 1


async def test_reminder_lunch_period_create_and_update(client: AsyncClient):
    token = await _signup_and_login(client, "user3@example.com")
    resp = await client.post(
        "/reminders",
        json={
            "title": "Standup",
            "repeat_type": "daily",
            "time": "09:00:00",
            "lunch_start": "13:00:00",
            "lunch_end": "14:00:00",
        },
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201, resp.text
    reminder = resp.json()
    assert reminder["lunch_start"] == "13:00:00"
    assert reminder["lunch_end"] == "14:00:00"

    resp = await client.put(
        f"/reminders/{reminder['id']}",
        json={"title": "Standup", "repeat_type": "daily", "time": "09:00:00", "lunch_start": None, "lunch_end": None},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["lunch_start"] is None
    assert resp.json()["lunch_end"] is None


async def test_reminder_lunch_start_without_lunch_end_is_rejected(client: AsyncClient):
    token = await _signup_and_login(client, "user4@example.com")
    resp = await client.post(
        "/reminders",
        json={"title": "Standup", "repeat_type": "daily", "time": "09:00:00", "lunch_start": "13:00:00"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 422


async def test_hourly_reminder_requires_active_hours_range(client: AsyncClient):
    token = await _signup_and_login(client, "user5@example.com")
    resp = await client.post(
        "/reminders",
        json={"title": "Stand and stretch", "repeat_type": "hourly"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 422

    resp = await client.post(
        "/reminders",
        json={
            "title": "Stand and stretch",
            "repeat_type": "hourly",
            "active_start": "09:00:00",
            "active_end": "18:00:00",
        },
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201, resp.text
    reminder = resp.json()
    assert reminder["active_start"] == "09:00:00"
    assert reminder["active_end"] == "18:00:00"
