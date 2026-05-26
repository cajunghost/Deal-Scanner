from __future__ import annotations

from urllib.parse import urlparse

from .base import Listing, Retailer
from .generic_jsonld import GenericJsonLdRetailer
from .pokemoncenter import PokemonCenter
from .target import Target
from .walmart import Walmart
from .bestbuy import BestBuy

__all__ = [
    "Listing",
    "Retailer",
    "get_retailer_for_url",
]


_HOST_MAP: dict[str, Retailer] = {
    "pokemoncenter.com": PokemonCenter(),
    "www.pokemoncenter.com": PokemonCenter(),
    "target.com": Target(),
    "www.target.com": Target(),
    "walmart.com": Walmart(),
    "www.walmart.com": Walmart(),
    "bestbuy.com": BestBuy(),
    "www.bestbuy.com": BestBuy(),
}

_FALLBACK = GenericJsonLdRetailer()


def get_retailer_for_url(url: str, hint: str | None = None) -> Retailer:
    if hint:
        for r in _HOST_MAP.values():
            if r.name.lower() == hint.lower():
                return r
    host = urlparse(url).hostname or ""
    return _HOST_MAP.get(host, _FALLBACK)
