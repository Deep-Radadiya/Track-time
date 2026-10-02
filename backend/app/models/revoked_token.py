"""Revoked refresh tokens (logged out or already used), so they can't be used again."""
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RevokedToken(Base):
    """Refresh tokens that were logged out or already used (rotation).
    Only a hash of the token is stored; rows are deleted after the token would have expired."""
    __tablename__ = "revoked_tokens"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
