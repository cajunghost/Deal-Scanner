from __future__ import annotations

import hashlib
import logging
from datetime import date, timedelta

from .config import Notifiers
from .drops import Drop
from .notifier import send_alert
from .state import State

log = logging.getLogger(__name__)


def notify_release_day(
    drops: list[Drop],
    notifiers: Notifiers,
    state: State,
    *,
    today: date | None = None,
    lookahead_days: int = 0,
) -> int:
    """Fire one alert per drop releasing today (or within lookahead_days).

    De-duplicates via state so re-running on the same day won't spam.
    Returns the number of alerts sent.
    """
    today = today or date.today()
    sent = 0
    horizon = today + timedelta(days=lookahead_days)
    for d in drops:
        if d.release_date is None:
            continue
        if not (today <= d.release_date <= horizon):
            continue
        key = _key(d, d.release_date)
        if state.get_alerted(key):
            continue
        title, message = _format(d, today)
        url = next(iter(d.links.values()), "")
        send_alert(notifiers, title=title, message=message, url=url)
        state.set_alerted(key, True)
        sent += 1
    return sent


def _format(drop: Drop, today: date) -> tuple[str, str]:
    days_out = (drop.release_date - today).days
    if days_out == 0:
        when = "drops today"
    elif days_out == 1:
        when = "drops tomorrow"
    else:
        when = f"drops in {days_out}d"
    title = f"📅 {drop.name} — {when}"

    lines = [f"Release: {drop.release_date.isoformat()} ({when})"]
    if drop.msrp is not None:
        lines.append(f"MSRP: ${drop.msrp:.2f}")
    if drop.notes:
        lines.append(drop.notes)
    if drop.links:
        lines.append("")
        lines.append("Buy at:")
        for retailer, url in sorted(drop.links.items()):
            lines.append(f"  · {retailer}: {url}")
    return title, "\n".join(lines)


def _key(drop: Drop, rd: date) -> str:
    h = hashlib.sha1(f"{drop.slug}|{rd.isoformat()}".encode()).hexdigest()[:12]
    return f"release-day:{drop.slug}:{h}"
