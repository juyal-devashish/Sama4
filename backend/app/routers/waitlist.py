import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.waitlist import WaitlistSignup
from app.services.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

router = APIRouter()

_limiter: RateLimiter | None = None


def _client_ip(request: Request) -> str:
    """The caller's IP as seen by our edge proxy.

    Railway appends the real client address to X-Forwarded-For, so the last entry is
    the one a client can't forge. Locally there is no proxy and request.client is used.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


async def _within_limit(ip: str) -> bool:
    """Check the per-IP signup limit. Fails open: if Redis is unreachable, allow it."""
    global _limiter
    try:
        if _limiter is None:
            _limiter = RateLimiter()
        allowed, _ = await _limiter.check_limit(ip, "waitlist_signups")
        return allowed
    except Exception:
        logger.warning("Waitlist rate limit check failed; allowing request.", exc_info=True)
        return True


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
    body: WaitlistRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> WaitlistResponse:
    """Add an email to the early-access waitlist.

    Signing up twice is not an error: the second request returns "exists".
    Each IP gets 5 attempts an hour; more return 429.
    """
    if not await _within_limit(_client_ip(request)):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many signups from this address. Try again later.",
            headers={"Retry-After": "3600"},
        )
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
