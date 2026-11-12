"""Waitlist (early-access signup) queries."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.waitlist import WaitlistSignup


async def exists(db: AsyncSession, email: str) -> bool:
    return (
        await db.scalar(select(WaitlistSignup.id).where(WaitlistSignup.email == email))
    ) is not None


async def add(db: AsyncSession, email: str, source: str = "announcements") -> bool:
    """Insert a signup. Returns False if the email was already there (e.g. a race)."""
    try:
        async with db.begin_nested():
            db.add(WaitlistSignup(email=email, source=source))
    except IntegrityError:
        return False
    return True
