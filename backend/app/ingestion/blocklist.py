"""Publisher opt-out: domains whose stories Samā4 must not ingest or show.

Set with the BLOCKED_PUBLISHERS env var, e.g. "ft.com, bloomberg.com". A domain also
blocks its subdomains (ft.com blocks www.ft.com), never look-alikes (myft.com).
"""

from urllib.parse import urlparse


def parse_domains(raw: str) -> frozenset[str]:
    """ "FT.com, https://www.bloomberg.com/ " -> {"ft.com", "bloomberg.com"}"""
    domains: set[str] = set()
    for part in raw.split(","):
        part = part.strip().lower()
        if not part:
            continue
        host = urlparse(part).hostname if "//" in part else part.split("/")[0]
        if host:
            domains.add(host.removeprefix("www."))
    return frozenset(domains)


def host_of(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def is_blocked(url: str, blocked: frozenset[str]) -> bool:
    host = host_of(url)
    return bool(host) and any(host == d or host.endswith("." + d) for d in blocked)


def allowed_sources(sources: list[dict], blocked: frozenset[str]) -> list[dict]:
    """Feeds whose feed URL isn't on a blocked publisher's domain."""
    return [s for s in sources if not is_blocked(s["url"], blocked)]
