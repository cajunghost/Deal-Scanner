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
    drop_slug: str | None = None


@dataclass
class WatchDropSpec:
    slug: str
    max_markup_pct: float | None = None
    poll_interval_seconds: int | None = None
    retailers: list[str] | None = None  # subset; None = all


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
    drops_files: list[str] = field(default_factory=list)
    drops_urls: list[str] = field(default_factory=list)
    watch_drops: list[WatchDropSpec] = field(default_factory=list)


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
            drop_slug=p.get("drop_slug"),
        )
        for p in data.get("products", [])
    ]

    watch_drops = []
    for entry in data.get("watch_drops", []) or []:
        if isinstance(entry, str):
            watch_drops.append(WatchDropSpec(slug=entry))
            continue
        if not isinstance(entry, dict) or "slug" not in entry:
            continue
        watch_drops.append(
            WatchDropSpec(
                slug=entry["slug"],
                max_markup_pct=entry.get("max_markup_pct"),
                poll_interval_seconds=entry.get("poll_interval_seconds"),
                retailers=entry.get("retailers"),
            )
        )

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
        drops_files=list(data.get("drops_files", []) or []),
        drops_urls=list(data.get("drops_urls", []) or []),
        watch_drops=watch_drops,
    )


def expand_watch_drops(
    config: Config, drops_by_slug: dict
) -> list[Product]:
    """Turn each WatchDropSpec into one Product per retailer link in its drop."""
    out: list[Product] = []
    for spec in config.watch_drops:
        drop = drops_by_slug.get(spec.slug)
        if drop is None:
            continue
        if drop.msrp is None:
            continue
        wanted = set(spec.retailers) if spec.retailers else None
        for retailer, url in drop.links.items():
            if wanted is not None and retailer not in wanted:
                continue
            out.append(
                Product(
                    name=f"{drop.name} @ {retailer}",
                    url=url,
                    msrp=drop.msrp,
                    retailer=retailer,
                    max_markup_pct=spec.max_markup_pct,
                    poll_interval_seconds=spec.poll_interval_seconds,
                    drop_slug=drop.slug,
                )
            )
    return out
