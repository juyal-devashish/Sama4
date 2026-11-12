import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.dbtypes import GUID


class WaitlistSignup(Base):
    """An email address that asked for early access on the announcements page."""

    __tablename__ = "waitlist_signups"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    source: Mapped[str] = mapped_column(String(50), default="announcements")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
