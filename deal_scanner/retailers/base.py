from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import requests


@dataclass(frozen=True)
class Listing:
    price: float | None
    in_stock: bool
    currency: str = "USD"
    raw_status: str = ""


class Retailer(Protocol):
    name: str

    def fetch(self, url: str, session: requests.Session) -> Listing: ...
