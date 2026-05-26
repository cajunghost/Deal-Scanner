from __future__ import annotations

import requests

from .base import Listing
from .generic_jsonld import parse_jsonld_offers


class Walmart:
    name = "walmart"

    def fetch(self, url: str, session: requests.Session) -> Listing:
        headers = {"Accept-Language": "en-US,en;q=0.9"}
        resp = session.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
        listing = parse_jsonld_offers(resp.text)
        if listing is not None:
            return listing
        return Listing(price=None, in_stock=False, raw_status="no-jsonld")
