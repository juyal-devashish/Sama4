"""Early-access waitlist (the form on /announcements). Public, rate-limited per IP."""

import logging
import re
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, field_validator

from app.api.deps import ContainerDep, DbSession
from app.repositories import waitlist as waitlist_repo

logger = logging.getLogger(__name__)
router = APIRouter()

SIGNUPS_PER_IP = 5
WINDOW_SECONDS = 3600
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
    status: Literal["joined", "exists"]


def client_ip(request: Request) -> str:
    """The caller's IP as seen by our edge proxy.

    Railway appends the real client address to X-Forwarded-For, so the last entry
    is the one a client can't forge. Locally there is no proxy: use request.client.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


@router.post("", response_model=WaitlistResponse, status_code=status.HTTP_201_CREATED)
async def join_waitlist(
    body: WaitlistRequest, request: Request, db: DbSession, c: ContainerDep
) -> WaitlistResponse:
    """Add an email to the early-access list. Signing up twice returns "exists".

    Each IP gets SIGNUPS_PER_IP attempts per hour (429 after that). If Redis is
    down the limit fails open: signups keep working and a warning is logged.
    """
    count = await c.cache.hit(f"ratelimit:waitlist:{client_ip(request)}", WINDOW_SECONDS)
    if count is None:
        logger.warning("Waitlist rate limit unavailable (no Redis); allowing request")
    elif count > SIGNUPS_PER_IP:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many signups from this address. Try again later.",
            headers={"Retry-After": str(WINDOW_SECONDS)},
        )

    if await waitlist_repo.exists(db, body.email):
        return WaitlistResponse(status="exists")
    added = await waitlist_repo.add(db, body.email)
    return WaitlistResponse(status="joined" if added else "exists")
