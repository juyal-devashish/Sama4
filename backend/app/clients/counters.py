"""Anonymous daily usage totals: how often things happen, never who did them.

A request that succeeds adds 1 to a counter named for the day and the event. Nothing else
is stored: no IP address, no cookie, no user agent, no identifier. Bots and prefetches are
counted too, because there is no way to tell them apart without identifying someone.
The privacy page says exactly this; change both together.
"""

import logging
from datetime import UTC, date, datetime, timedelta

from app.clients.cache import Cache

logger = logging.getLogger(__name__)

# (HTTP method, route template) -> event name. Only these are counted.
EVENTS: dict[tuple[str, str], str] = {
    ("GET", "/api/v1/articles/{article_id}"): "story_opened",
    ("GET", "/api/v1/context/{entity_id}"): "term_explained",
    ("GET", "/api/v1/context/{entity_id}/stream"): "term_explained",
    ("POST", "/api/v1/context/selection"): "selection_explained",
    ("POST", "/api/v1/context/explain"): "followup_asked",
    ("POST", "/api/v1/predictions/simulate"): "outlook_started",
}
EVENT_NAMES = sorted(set(EVENTS.values()))
KEEP_DAYS = 400  # about 13 months


def _key(day: date, event: str) -> str:
    return f"usage:{day.isoformat()}:{event}"


class UsageCounters:
    def __init__(self, cache: Cache) -> None:
        self.cache = cache

    async def count(self, event: str) -> None:
        """Add one to today's total for `event`. Never raises; no Redis means no counting."""
        try:
            today = datetime.now(UTC).date()
            await self.cache.add(_key(today, event), 1, ttl_seconds=KEEP_DAYS * 86400)
        except Exception:
            logger.warning("Could not count %s", event, exc_info=True)

    async def totals(self, days: int) -> list[dict]:
        """The last `days` days, newest first: [{"day": "2026-11-15", "events": {...}}].

        None for an event means the counter store was unavailable, not zero.
        """
        today = datetime.now(UTC).date()
        out = []
        for back in range(days):
            day = today - timedelta(days=back)
            events = {e: await self.cache.counter(_key(day, e)) for e in EVENT_NAMES}
            out.append({"day": day.isoformat(), "events": events})
        return out
