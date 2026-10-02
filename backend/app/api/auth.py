import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_current_user
from app.core.security import decode_token, create_access_token, create_refresh_token
from app.database import get_db
from app.models import User, RevokedToken
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse, RefreshRequest, UserResponse, LogoutRequest, UserUpdate
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def _is_revoked(db: AsyncSession, token: str) -> bool:
    return await db.get(RevokedToken, _hash(token)) is not None


async def _revoke(db: AsyncSession, token: str) -> None:
    """Remember a refresh token as unusable until it would have expired anyway."""
    now = datetime.now(timezone.utc)
    await db.execute(delete(RevokedToken).where(RevokedToken.expires_at < now))  # tidy up old rows
    if await db.get(RevokedToken, _hash(token)) is None:
        expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        db.add(RevokedToken(token_hash=_hash(token), expires_at=expires))
    await db.commit()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await auth_service.get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = await auth_service.create_user(db, payload.email, payload.password, payload.timezone)
    access, refresh = auth_service.issue_tokens(user)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access, refresh = auth_service.issue_tokens(user)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    # Reject blocklisted tokens (already used or explicitly logged out).
    if await _is_revoked(db, payload.refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked")

    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise ValueError("not a refresh token")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    new_access = create_access_token(data["sub"])
    new_refresh = create_refresh_token(data["sub"])

    # Token rotation: invalidate the used refresh token so it can't be reused.
    await _revoke(db, payload.refresh_token)

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: LogoutRequest,
    db: AsyncSession = Depends(get_db),
):
    """Mark the refresh token as revoked so it can never be used again."""
    await _revoke(db, payload.refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    await db.commit()
    await db.refresh(current_user)
    return current_user

