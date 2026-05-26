from __future__ import annotations

import hashlib
from datetime import date, datetime, timedelta, timezone

from .drops import Drop


def render_calendar(drops: list[Drop], *, calendar_name: str = "Pokémon TCG Drops") -> str:
    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//deal-scanner//pokemon-drops//EN",
        "CALSCALE:GREGORIAN",
        f"X-WR-CALNAME:{_escape(calendar_name)}",
    ]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    for d in drops:
        if d.release_date is None:
            continue
        lines.extend(_event_lines(d, stamp))
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def _event_lines(drop: Drop, dtstamp: str) -> list[str]:
    uid = hashlib.sha1(f"{drop.slug}@deal-scanner".encode()).hexdigest()
    dtstart = drop.release_date.strftime("%Y%m%d")
    dtend = (drop.release_date + timedelta(days=1)).strftime("%Y%m%d")
    desc_parts: list[str] = []
    if drop.msrp is not None:
        desc_parts.append(f"MSRP: ${drop.msrp:.2f}")
    if drop.notes:
        desc_parts.append(drop.notes)
    if drop.links:
        desc_parts.append("Retailers:")
        for retailer, url in sorted(drop.links.items()):
            desc_parts.append(f"  - {retailer}: {url}")
    description = "\\n".join(_escape(p) for p in desc_parts)
    primary_url = next(iter(drop.links.values()), "")

    out = [
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART;VALUE=DATE:{dtstart}",
        f"DTEND;VALUE=DATE:{dtend}",
        f"SUMMARY:{_escape(drop.name)}",
    ]
    if description:
        out.append(_fold(f"DESCRIPTION:{description}"))
    if primary_url:
        out.append(f"URL:{primary_url}")
    out.append("END:VEVENT")
    return out


def _escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(",", "\\,")
        .replace(";", "\\;")
        .replace("\n", "\\n")
    )


def _fold(line: str, limit: int = 73) -> str:
    if len(line) <= limit:
        return line
    chunks = [line[:limit]]
    rest = line[limit:]
    while rest:
        chunks.append(" " + rest[: limit - 1])
        rest = rest[limit - 1 :]
    return "\r\n".join(chunks)
