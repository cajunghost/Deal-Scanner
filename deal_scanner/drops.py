from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse

import requests
import yaml

log = logging.getLogger(__name__)


@dataclass
class Drop:
    slug: str
    name: str
    release_date: date | None
    msrp: float | None = None
    notes: str = ""
    links: dict[str, str] = field(default_factory=dict)
    source: str = ""

    def is_upcoming(self, today: date | None = None) -> bool:
        if self.release_date is None:
            return False
        return self.release_date >= (today or date.today())

    def days_until(self, today: date | None = None) -> int | None:
        if self.release_date is None:
            return None
        return (self.release_date - (today or date.today())).days


def load_drops(
    files: list[str | Path] | None = None,
    urls: list[str] | None = None,
    *,
    user_agent: str = "DealScannerBot/0.1",
    timeout: float = 15.0,
) -> list[Drop]:
    """Merge drop entries from local YAML files and remote YAML/JSON URLs.

    Later sources override earlier ones on slug collision.
    """
    seen: dict[str, Drop] = {}
    for path in files or []:
        for drop in _parse_drops(_read_local(path), source=str(path)):
            seen[drop.slug] = drop
    for url in urls or []:
        try:
            payload = _read_remote(url, user_agent=user_agent, timeout=timeout)
        except requests.RequestException as e:
            log.warning("Could not fetch drops source %s: %s", url, e)
            continue
        for drop in _parse_drops(payload, source=url):
            seen[drop.slug] = drop
    return sorted(seen.values(), key=_sort_key)


def upcoming(
    drops: list[Drop], *, within_days: int | None = None, today: date | None = None
) -> list[Drop]:
    today = today or date.today()
    out = [d for d in drops if d.is_upcoming(today)]
    if within_days is not None:
        cutoff = today + timedelta(days=within_days)
        out = [d for d in out if d.release_date and d.release_date <= cutoff]
    return out


def find_by_slug(drops: list[Drop], slug: str) -> Drop | None:
    for d in drops:
        if d.slug == slug:
            return d
    return None


def _sort_key(d: Drop) -> tuple[int, str]:
    if d.release_date is None:
        return (10**9, d.slug)
    return (d.release_date.toordinal(), d.slug)


def _read_local(path: str | Path) -> dict:
    text = Path(path).read_text()
    return yaml.safe_load(text) or {}


def _read_remote(url: str, *, user_agent: str, timeout: float) -> dict:
    resp = requests.get(
        url, headers={"User-Agent": user_agent}, timeout=timeout
    )
    resp.raise_for_status()
    parsed = urlparse(url)
    body = resp.text
    if parsed.path.endswith(".json"):
        return json.loads(body)
    return yaml.safe_load(body) or {}


def _parse_drops(payload: dict, *, source: str) -> list[Drop]:
    raw = payload.get("drops", []) if isinstance(payload, dict) else []
    out: list[Drop] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        slug = entry.get("slug") or entry.get("id")
        name = entry.get("name") or slug
        if not slug or not name:
            continue
        rd = _to_date(entry.get("release_date"))
        msrp = entry.get("msrp")
        try:
            msrp_f = float(msrp) if msrp is not None else None
        except (TypeError, ValueError):
            msrp_f = None
        links_raw = entry.get("links") or {}
        links = {
            str(k).lower(): str(v) for k, v in links_raw.items() if v
        }
        out.append(
            Drop(
                slug=str(slug),
                name=str(name),
                release_date=rd,
                msrp=msrp_f,
                notes=str(entry.get("notes") or ""),
                links=links,
                source=source,
            )
        )
    return out


def _to_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    s = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    log.warning("Unparseable release_date %r", value)
    return None
