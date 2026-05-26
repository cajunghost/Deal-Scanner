from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml


@dataclass
class Product:
    name: str
    url: str
    msrp: float
    retailer: str | None = None
    max_markup_pct: float | None = None
    poll_interval_seconds: int | None = None


@dataclass
class Notifiers:
    discord_webhook_url: str | None = None
    ntfy_topic_url: str | None = None


@dataclass
class Config:
    products: list[Product] = field(default_factory=list)
    notifiers: Notifiers = field(default_factory=Notifiers)
    default_poll_interval_seconds: int = 600
    default_max_markup_pct: float = 10.0
    user_agent: str = (
        "DealScannerBot/0.1 (+restock-alerts; contact: set in config)"
    )
    state_file: str = "state.json"
    respect_robots_txt: bool = True


def load_config(path: str | Path) -> Config:
    data = yaml.safe_load(Path(path).read_text())
    if not data:
        raise ValueError(f"Config file {path} is empty")

    notif_data = data.get("notifiers") or {}
    notifiers = Notifiers(
        discord_webhook_url=notif_data.get("discord_webhook_url"),
        ntfy_topic_url=notif_data.get("ntfy_topic_url"),
    )

    products = [
        Product(
            name=p["name"],
            url=p["url"],
            msrp=float(p["msrp"]),
            retailer=p.get("retailer"),
            max_markup_pct=p.get("max_markup_pct"),
            poll_interval_seconds=p.get("poll_interval_seconds"),
        )
        for p in data.get("products", [])
    ]

    return Config(
        products=products,
        notifiers=notifiers,
        default_poll_interval_seconds=int(
            data.get("default_poll_interval_seconds", 600)
        ),
        default_max_markup_pct=float(data.get("default_max_markup_pct", 10.0)),
        user_agent=data.get(
            "user_agent",
            "DealScannerBot/0.1 (+restock-alerts; contact: set in config)",
        ),
        state_file=data.get("state_file", "state.json"),
        respect_robots_txt=bool(data.get("respect_robots_txt", True)),
    )
