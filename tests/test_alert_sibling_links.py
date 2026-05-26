from __future__ import annotations

from datetime import date
from pathlib import Path
from unittest.mock import MagicMock

import requests

from deal_scanner.config import Config, Notifiers, Product
from deal_scanner.drops import Drop
from deal_scanner.retailers.base import Listing
from deal_scanner.scanner import _check_one, _Schedule
from deal_scanner.state import State


def test_alert_includes_sibling_retailer_links(tmp_path: Path, monkeypatch):
    drop = Drop(
        slug="bb",
        name="Booster Box",
        release_date=date(2026, 9, 1),
        msrp=100.0,
        links={
            "pokemoncenter": "https://www.pokemoncenter.com/x",
            "target": "https://www.target.com/x",
            "walmart": "https://www.walmart.com/x",
        },
    )

    p = Product(
        name="BB @ pokemoncenter",
        url="https://www.pokemoncenter.com/x",
        msrp=100.0,
        drop_slug="bb",
    )
    s = _Schedule(product=p, next_run=0.0, interval=600.0, max_markup_pct=10.0)

    fake_retailer = MagicMock()
    fake_retailer.name = "pokemoncenter"
    fake_retailer.fetch.return_value = Listing(price=100.0, in_stock=True)
    monkeypatch.setattr(
        "deal_scanner.scanner.get_retailer_for_url", lambda *a, **kw: fake_retailer
    )

    captured: dict = {}
    monkeypatch.setattr(
        "deal_scanner.scanner.send_alert",
        lambda notifiers, *, title, message, url: captured.update(
            title=title, message=message, url=url
        ),
    )

    state = State(tmp_path / "state.json")
    cfg = Config(products=[p], notifiers=Notifiers())
    _check_one(s, cfg, requests.Session(), state, None, {drop.slug: drop})

    message = captured["message"]
    assert "Also try:" in message
    assert "target: https://www.target.com/x" in message
    assert "walmart: https://www.walmart.com/x" in message
    # The retailer the alert is FOR should not be listed under "Also try:"
    other_section = message.split("Also try:", 1)[1]
    assert "https://www.pokemoncenter.com/x" not in other_section
