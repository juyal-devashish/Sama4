import json
import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """Redis cache for entity contexts and LLM responses."""

    def __init__(self) -> None:
        self._redis = None
        if settings.redis_url:
            try:
                import redis.asyncio as redis

                self._redis = redis.from_url(settings.redis_url, decode_responses=True)
            except Exception:
                logger.warning("Redis not available, caching disabled")

    async def get(self, key: str) -> dict | None:
        """Get a cached value by key."""
        if not self._redis:
            return None
        try:
            value = await self._redis.get(key)
            if value:
                return json.loads(value)
        except Exception:
            logger.warning("Redis get failed", exc_info=True)
        return None

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Set a cached value with optional TTL in seconds."""
        if not self._redis:
            return
        try:
            serialized = json.dumps(value, default=str)
            if ttl:
                await self._redis.setex(key, ttl, serialized)
            else:
                await self._redis.set(key, serialized)
        except Exception:
            logger.warning("Redis set failed", exc_info=True)

    async def delete(self, key: str) -> None:
        """Delete a cached value."""
        if not self._redis:
            return
        try:
            await self._redis.delete(key)
        except Exception:
            logger.warning("Redis delete failed", exc_info=True)

    async def close(self) -> None:
        """Close the Redis connection."""
        if self._redis:
            await self._redis.close()
