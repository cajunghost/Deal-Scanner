from __future__ import annotations

import json
import logging
from typing import Any

import requests
from bs4 import BeautifulSoup

from .base import Listing

log = logging.getLogger(__name__)

_IN_STOCK_TOKENS = {
    "instock",
    "in_stock",
    "in stock",
    "onlineonly",
    "limitedavailability",
    "preorder",
}
_OUT_STOCK_TOKENS = {
    "outofstock",
    "out_of_stock",
    "out of stock",
    "soldout",
    "discontinued",
}


def parse_jsonld_offers(html: str) -> Listing | None:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        for node in _walk(data):
            if not isinstance(node, dict):
                continue
            if _type_of(node) != "Product":
                continue
            listing = _listing_from_product(node)
            if listing is not None:
                return listing
    return None


def _walk(node: Any):
    if isinstance(node, list):
        for item in node:
            yield from _walk(item)
    elif isinstance(node, dict):
        yield node
        for v in node.values():
            yield from _walk(v)


def _type_of(node: dict) -> str:
    t = node.get("@type")
    if isinstance(t, list):
        return next((x for x in t if isinstance(x, str)), "")
    return t or ""


def _listing_from_product(product: dict) -> Listing | None:
    offers = product.get("offers")
    if offers is None:
        return None
    if isinstance(offers, list):
        candidates = offers
    else:
        candidates = [offers]

    best_price: float | None = None
    in_stock = False
    currency = "USD"
    raw_status = ""

    for offer in candidates:
        if not isinstance(offer, dict):
            continue
        if _type_of(offer) == "AggregateOffer":
            low = offer.get("lowPrice") or offer.get("price")
            price = _to_float(low)
        else:
            price = _to_float(offer.get("price"))
        if price is not None and (best_price is None or price < best_price):
            best_price = price
        currency = offer.get("priceCurrency") or currency
        avail = (offer.get("availability") or "").lower()
        raw_status = avail or raw_status
        if any(tok in avail for tok in _IN_STOCK_TOKENS):
            in_stock = True
        elif any(tok in avail for tok in _OUT_STOCK_TOKENS):
            pass

    if best_price is None and not raw_status:
        return None
    return Listing(
        price=best_price,
        in_stock=in_stock,
        currency=currency,
        raw_status=raw_status,
    )


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).replace(",", "").replace("$", "").strip())
    except (TypeError, ValueError):
        return None


class GenericJsonLdRetailer:
    name = "generic"

    def fetch(self, url: str, session: requests.Session) -> Listing:
        resp = session.get(url, timeout=20)
        resp.raise_for_status()
        listing = parse_jsonld_offers(resp.text)
        if listing is None:
            log.debug("No JSON-LD Product offer found at %s", url)
            return Listing(price=None, in_stock=False, raw_status="no-jsonld")
        return listing
