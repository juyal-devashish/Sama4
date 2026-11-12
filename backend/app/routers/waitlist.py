import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.waitlist import WaitlistSignup

router = APIRouter()

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class WaitlistRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) > 255 or not _EMAIL.match(v):
            raise ValueError("Enter a valid email address")
        return v


class WaitlistResponse(BaseModel):
    status: str


@router.post("", response_model=WaitlistResponse, status_code=status.HTTP_201_CREATED)
async def join_waitlist(
    body: WaitlistRequest, db: AsyncSession = Depends(get_db)
) -> WaitlistResponse:
    """Add an email to the early-access waitlist.

    Signing up twice is not an error: the second request returns "exists".
    """
    existing = await db.scalar(select(WaitlistSignup).where(WaitlistSignup.email == body.email))
    if existing:
        return WaitlistResponse(status="exists")
    db.add(WaitlistSignup(email=body.email))
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Could not save signup") from exc
    return WaitlistResponse(status="joined")
