"""Cross-dialect SQLAlchemy types that work with both PostgreSQL and SQLite."""

import uuid

from sqlalchemy import String, TypeDecorator
from sqlalchemy.types import JSON

from app.database import IS_SQLITE

if IS_SQLITE:

    class GUID(TypeDecorator):
        """UUID stored as string in SQLite."""

        impl = String(36)
        cache_ok = True

        def process_bind_param(self, value, dialect):
            if value is not None:
                return str(value)
            return value

        def process_result_value(self, value, dialect):
            if value is not None:
                return uuid.UUID(value)
            return value

    # Use JSON for arrays in SQLite
    StringArray = JSON

else:
    from sqlalchemy.dialects.postgresql import ARRAY
    from sqlalchemy.dialects.postgresql import UUID as PG_UUID

    GUID = PG_UUID(as_uuid=True)
    StringArray = ARRAY(String)


def uuid_array():
    """UUID array: JSON on SQLite, ARRAY(UUID) on PostgreSQL."""
    if IS_SQLITE:
        return JSON
    from sqlalchemy.dialects.postgresql import ARRAY
    from sqlalchemy.dialects.postgresql import UUID as PG_UUID

    return ARRAY(PG_UUID(as_uuid=True))
