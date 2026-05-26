from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

from deal_scanner.config import Notifiers
from deal_scanner.drops import Drop
from deal_scanner.notify_drops import notify_release_day
from deal_scanner.state import State


def _drop(slug: str, rd: date | None, **kw) -> Drop:
    base = dict(
        name=f"Drop {slug}",
        msrp=49.99,
        links={
            "pokemoncenter": f"https://example.com/{slug}/pc",
            "target": f"https://example.com/{slug}/tg",
        },
    )
    base.update(kw)
    return Drop(slug=slug, release_date=rd, **base)


def test_notifies_only_drops_releasing_today(tmp_path: Path, monkeypatch):
    today = date(2026, 5, 26)
    drops = [
        _drop("today", today),
        _drop("yesterday", today - timedelta(days=1)),
        _drop("tomorrow", today + timedelta(days=1)),
        _drop("no-date", None),
    ]

    sent: list[str] = []
    monkeypatch.setattr(
        "deal_scanner.notify_drops.send_alert",
        lambda notifiers, *, title, message, url: sent.append(title),
    )

    state = State(tmp_path / "s.json")
    n = notify_release_day(drops, Notifiers(), state, today=today)
    assert n == 1
    assert "today" in sent[0].lower() or "Drop today" in sent[0]


def test_lookahead_includes_near_future(tmp_path: Path, monkeypatch):
    today = date(2026, 5, 26)
    drops = [
        _drop("d0", today),
        _drop("d1", today + timedelta(days=1)),
        _drop("d3", today + timedelta(days=3)),
    ]
    sent: list = []
    monkeypatch.setattr(
        "deal_scanner.notify_drops.send_alert",
        lambda *a, **kw: sent.append(1),
    )
    state = State(tmp_path / "s.json")
    n = notify_release_day(drops, Notifiers(), state, today=today, lookahead_days=1)
    assert n == 2


def test_dedupes_on_repeat_run(tmp_path: Path, monkeypatch):
    today = date(2026, 5, 26)
    drops = [_drop("d0", today)]
    sent: list = []
    monkeypatch.setattr(
        "deal_scanner.notify_drops.send_alert",
        lambda *a, **kw: sent.append(1),
    )
    state = State(tmp_path / "s.json")
    notify_release_day(drops, Notifiers(), state, today=today)
    notify_release_day(drops, Notifiers(), state, today=today)
    assert len(sent) == 1


def test_message_includes_all_retailer_links(tmp_path: Path, monkeypatch):
    today = date(2026, 5, 26)
    d = _drop("d", today)
    captured: dict = {}
    monkeypatch.setattr(
        "deal_scanner.notify_drops.send_alert",
        lambda notifiers, *, title, message, url: captured.update(
            title=title, message=message, url=url
        ),
    )
    state = State(tmp_path / "s.json")
    notify_release_day([d], Notifiers(), state, today=today)
    assert "pokemoncenter:" in captured["message"]
    assert "target:" in captured["message"]
    assert "https://example.com/d/pc" in captured["message"]
