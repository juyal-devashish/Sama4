"""Daily Claude token meter: counts every call and enforces a cap on reader-facing ones."""

import logging
from datetime import UTC, datetime, timedelta

from app.clients.cache import Cache

logger = logging.getLogger(__name__)

ALERT_AT_PERCENT = (80, 100)


class DailyBudgetExceeded(Exception):  # noqa: N818 - reads as a condition, not an error
    """Today's Claude token budget is used up."""

    def __init__(self, retry_after: int = 3600) -> None:
        super().__init__("Samā4 has reached its daily limit for AI answers.")
        self.retry_after = retry_after


def _today() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


def seconds_until_utc_midnight() -> int:
    now = datetime.now(UTC)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(1, int((tomorrow - now).total_seconds()))


class UsageMeter:
    """Tokens used per UTC day, kept in Redis.

    With no Redis the meter can't count, so it never blocks (and logs nothing per call).
    A cap of 0 turns the cap off but keeps counting.
    """

    def __init__(self, cache: Cache, daily_cap: int) -> None:
        self.cache = cache
        self.daily_cap = daily_cap

    @staticmethod
    def _key() -> str:
        return f"llm:tokens:{_today()}"

    async def used_today(self) -> int | None:
        return await self.cache.counter(self._key())

    async def exceeded(self) -> bool:
        if self.daily_cap <= 0:
            return False
        used = await self.used_today()
        return used is not None and used >= self.daily_cap

    async def record(self, tokens: int) -> None:
        """Count tokens, and raise an alert the moment the day crosses 80% and 100% of the cap."""
        if tokens <= 0:
            return
        total = await self.cache.add(self._key(), tokens, ttl_seconds=2 * 86400)
        if total is None or self.daily_cap <= 0:
            return
        before = total - tokens
        for percent in ALERT_AT_PERCENT:
            threshold = self.daily_cap * percent // 100
            if before < threshold <= total:
                self._alert(percent, total)

    def _alert(self, percent: int, total: int) -> None:
        message = (
            f"Claude daily token budget at {percent}%: {total:,} of {self.daily_cap:,} tokens "
            f"used today (UTC)."
            + (
                " Reader-facing AI features are now paused until tomorrow."
                if percent >= 100
                else ""
            )
        )
        logger.error(message)
        try:
            import sentry_sdk

            sentry_sdk.capture_message(message, level="error")
        except Exception:
            logger.warning("Could not send the budget alert to Sentry", exc_info=True)
