import redis.asyncio as redis

from app.config import settings

RATE_LIMITS = {
    "context_requests": {
        "limit": settings.context_rate_limit,
        "window_seconds": settings.rate_limit_window,
    },
    "followup_questions": {
        "limit": settings.followup_rate_limit,
        "window_seconds": settings.rate_limit_window,
    },
    # Early-access signups: a person needs one, retries for typos need a few.
    "waitlist_signups": {
        "limit": 5,
        "window_seconds": 3600,
    },
}


class RateLimiter:
    """Sliding window rate limiter using Redis."""

    def __init__(self) -> None:
        self.redis = redis.from_url(settings.redis_url, decode_responses=True)

    async def check_limit(self, identifier: str, limit_type: str) -> tuple[bool, int]:
        """Check if a request is within rate limits.

        Args:
            identifier: IP address or user ID.
            limit_type: Type of rate limit to check.

        Returns:
            Tuple of (is_allowed, remaining_requests).
        """
        config = RATE_LIMITS[limit_type]
        key = f"ratelimit:{identifier}:{limit_type}"

        current = await self.redis.incr(key)

        if current == 1:
            await self.redis.expire(key, config["window_seconds"])

        remaining = max(0, config["limit"] - current)
        is_allowed = current <= config["limit"]

        return is_allowed, remaining
