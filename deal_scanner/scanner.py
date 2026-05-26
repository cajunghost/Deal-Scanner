from __future__ import annotations

import hashlib
import logging
import random
import time
from dataclasses import dataclass

import requests
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .config import Config, Product
from .notifier import send_alert
from .retailers import Listing, get_retailer_for_url
from .robots import RobotsCache
from .state import State

log = logging.getLogger(__name__)


@dataclass
class _Schedule:
    product: Product
    next_run: float
    interval: float
    max_markup_pct: float


def run(config: Config) -> None:
    state = State(config.state_file)
    robots = RobotsCache(config.user_agent) if config.respect_robots_txt else None
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": config.user_agent,
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    now = time.time()
    schedule = [
        _Schedule(
            product=p,
            next_run=now + random.uniform(0, 5),
            interval=float(
                p.poll_interval_seconds or config.default_poll_interval_seconds
            ),
            max_markup_pct=float(
                p.max_markup_pct
                if p.max_markup_pct is not None
                else config.default_max_markup_pct
            ),
        )
        for p in config.products
    ]

    if not schedule:
        log.warning("No products configured. Exiting.")
        return

    log.info("Watching %d product(s)", len(schedule))

    while True:
        now = time.time()
        due = [s for s in schedule if s.next_run <= now]
        for s in due:
            try:
                _check_one(s, config, session, state, robots)
            except Exception:
                log.exception("Error checking %s", s.product.name)
            jitter = random.uniform(0.85, 1.15)
            s.next_run = time.time() + s.interval * jitter

        sleep_for = max(1.0, min(s.next_run for s in schedule) - time.time())
        time.sleep(min(sleep_for, 30.0))


def _check_one(
    s: _Schedule,
    config: Config,
    session: requests.Session,
    state: State,
    robots: RobotsCache | None,
) -> None:
    p = s.product
    if robots is not None and not robots.can_fetch(p.url):
        log.warning("robots.txt disallows fetching %s; skipping", p.url)
        return

    retailer = get_retailer_for_url(p.url, hint=p.retailer)
    log.debug("Checking %s via %s", p.name, retailer.name)
    listing = _fetch_with_retry(retailer, p.url, session)

    threshold = p.msrp * (1 + s.max_markup_pct / 100.0)
    key = _state_key(p)
    favorable = (
        listing.in_stock
        and listing.price is not None
        and listing.price <= threshold
    )

    if favorable and not state.get_alerted(key):
        title = f"In stock at MSRP-ish: {p.name}"
        message = (
            f"Price ${listing.price:.2f} {listing.currency} "
            f"(MSRP ${p.msrp:.2f}, max ${threshold:.2f}) at {retailer.name}"
        )
        send_alert(config.notifiers, title=title, message=message, url=p.url)
        state.set_alerted(key, True)
    elif not favorable and state.get_alerted(key):
        state.set_alerted(key, False)

    log.info(
        "%-30s %-12s price=%s in_stock=%s status=%s threshold=%.2f",
        p.name[:30],
        retailer.name,
        f"{listing.price:.2f}" if listing.price is not None else "?",
        listing.in_stock,
        listing.raw_status or "-",
        threshold,
    )


@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(requests.RequestException),
)
def _fetch_with_retry(retailer, url: str, session: requests.Session) -> Listing:
    return retailer.fetch(url, session)


def _state_key(p: Product) -> str:
    h = hashlib.sha1(p.url.encode("utf-8")).hexdigest()[:12]
    return f"{p.name}:{h}"
