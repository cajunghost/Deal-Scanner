from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import requests

from deal_scanner.config import Config, Notifiers, Product
from deal_scanner.retailers.base import Listing
from deal_scanner.scanner import _check_one, _Schedule, _state_key
from deal_scanner.state import State


def _make_schedule(msrp: float, max_markup_pct: float = 10.0) -> _Schedule:
    p = Product(
        name="Test Booster",
        url="https://example.com/p/test",
        msrp=msrp,
    )
    return _Schedule(
        product=p,
        next_run=0.0,
        interval=600.0,
        max_markup_pct=max_markup_pct,
    )


def test_alerts_when_price_at_msrp(tmp_path: Path, monkeypatch):
    s = _make_schedule(msrp=100.0)
    listing = Listing(price=100.0, in_stock=True)

    fake_retailer = MagicMock()
    fake_retailer.name = "fake"
    fake_retailer.fetch.return_value = listing

    monkeypatch.setattr(
        "deal_scanner.scanner.get_retailer_for_url", lambda *a, **kw: fake_retailer
    )

    alerts: list[tuple[str, str, str]] = []
    monkeypatch.setattr(
        "deal_scanner.scanner.send_alert",
        lambda notifiers, *, title, message, url: alerts.append((title, message, url)),
    )

    config = Config(products=[s.product], notifiers=Notifiers())
    state = State(tmp_path / "state.json")
    _check_one(s, config, requests.Session(), state, robots=None)

    assert len(alerts) == 1
    assert state.get_alerted(_state_key(s.product)) is True


def test_alerts_within_markup_tolerance(tmp_path: Path, monkeypatch):
    s = _make_schedule(msrp=100.0, max_markup_pct=10.0)
    listing = Listing(price=109.99, in_stock=True)

    fake_retailer = MagicMock()
    fake_retailer.name = "fake"
    fake_retailer.fetch.return_value = listing

    monkeypatch.setattr(
        "deal_scanner.scanner.get_retailer_for_url", lambda *a, **kw: fake_retailer
    )
    alerts: list[tuple] = []
    monkeypatch.setattr(
        "deal_scanner.scanner.send_alert",
        lambda *a, **kw: alerts.append((a, kw)),
    )

    config = Config(products=[s.product], notifiers=Notifiers())
    state = State(tmp_path / "state.json")
    _check_one(s, config, requests.Session(), state, robots=None)
    assert len(alerts) == 1


def test_no_alert_when_over_markup(tmp_path: Path, monkeypatch):
    s = _make_schedule(msrp=100.0, max_markup_pct=10.0)
    listing = Listing(price=120.0, in_stock=True)

    fake_retailer = MagicMock()
    fake_retailer.name = "fake"
    fake_retailer.fetch.return_value = listing

    monkeypatch.setattr(
        "deal_scanner.scanner.get_retailer_for_url", lambda *a, **kw: fake_retailer
    )
    alerts: list = []
    monkeypatch.setattr(
        "deal_scanner.scanner.send_alert",
        lambda *a, **kw: alerts.append(1),
    )

    config = Config(products=[s.product], notifiers=Notifiers())
    state = State(tmp_path / "state.json")
    _check_one(s, config, requests.Session(), state, robots=None)
    assert alerts == []


def test_no_alert_when_out_of_stock(tmp_path: Path, monkeypatch):
    s = _make_schedule(msrp=100.0)
    listing = Listing(price=99.0, in_stock=False)

    fake_retailer = MagicMock()
    fake_retailer.name = "fake"
    fake_retailer.fetch.return_value = listing

    monkeypatch.setattr(
        "deal_scanner.scanner.get_retailer_for_url", lambda *a, **kw: fake_retailer
    )
    alerts: list = []
    monkeypatch.setattr(
        "deal_scanner.scanner.send_alert",
        lambda *a, **kw: alerts.append(1),
    )

    config = Config(products=[s.product], notifiers=Notifiers())
    state = State(tmp_path / "state.json")
    _check_one(s, config, requests.Session(), state, robots=None)
    assert alerts == []


def test_state_resets_when_listing_goes_unfavorable(tmp_path: Path, monkeypatch):
    s = _make_schedule(msrp=100.0)
    fake_retailer = MagicMock()
    fake_retailer.name = "fake"

    monkeypatch.setattr(
        "deal_scanner.scanner.get_retailer_for_url", lambda *a, **kw: fake_retailer
    )
    sends: list = []
    monkeypatch.setattr(
        "deal_scanner.scanner.send_alert", lambda *a, **kw: sends.append(1)
    )

    config = Config(products=[s.product], notifiers=Notifiers())
    state = State(tmp_path / "state.json")

    fake_retailer.fetch.return_value = Listing(price=100.0, in_stock=True)
    _check_one(s, config, requests.Session(), state, robots=None)
    assert state.get_alerted(_state_key(s.product)) is True
    assert len(sends) == 1

    # Same favorable state — should not re-alert
    _check_one(s, config, requests.Session(), state, robots=None)
    assert len(sends) == 1

    # Goes out of stock — state should reset
    fake_retailer.fetch.return_value = Listing(price=100.0, in_stock=False)
    _check_one(s, config, requests.Session(), state, robots=None)
    assert state.get_alerted(_state_key(s.product)) is False

    # Comes back in stock — should alert again
    fake_retailer.fetch.return_value = Listing(price=100.0, in_stock=True)
    _check_one(s, config, requests.Session(), state, robots=None)
    assert len(sends) == 2
