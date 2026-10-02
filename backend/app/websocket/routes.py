"""
WebSocket endpoint: validates the access token, then registers the socket with the
in-process ConnectionManager so task changes and day-end summaries reach the browser live.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy import select

from app.core.security import decode_token
from app.database import AsyncSessionLocal
from app.models import User
from app.websocket.connection_manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    # --- Auth ---
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError
        from uuid import UUID
        user_id = UUID(payload["sub"])
    except (ValueError, KeyError, TypeError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        if result.scalar_one_or_none() is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    # --- Connect to in-process manager ---
    await manager.connect(user_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            # Clients may send lightweight pings; relay any task mutation
            # notices to this user's other connections.
            await manager.broadcast_to_user(user_id, data, exclude=websocket)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, websocket)
