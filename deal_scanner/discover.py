from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote_plus


@dataclass(frozen=True)
class SearchSpec:
    retailer: str
    template: str

    def url_for(self, query: str) -> str:
        return self.template.format(q=quote_plus(query))


SEARCH_SPECS: list[SearchSpec] = [
    SearchSpec(
        "pokemoncenter",
        "https://www.pokemoncenter.com/search?q={q}",
    ),
    SearchSpec(
        "target",
        "https://www.target.com/s?searchTerm={q}",
    ),
    SearchSpec(
        "walmart",
        "https://www.walmart.com/search?q={q}",
    ),
    SearchSpec(
        "bestbuy",
        "https://www.bestbuy.com/site/searchpage.jsp?st={q}",
    ),
    SearchSpec(
        "gamestop",
        "https://www.gamestop.com/search/?q={q}",
    ),
    SearchSpec(
        "amazon",
        "https://www.amazon.com/s?k={q}",
    ),
]


def search_urls(query: str, retailers: list[str] | None = None) -> dict[str, str]:
    wanted = set(r.lower() for r in retailers) if retailers else None
    return {
        s.retailer: s.url_for(query)
        for s in SEARCH_SPECS
        if wanted is None or s.retailer in wanted
    }


def slugify(text: str) -> str:
    cleaned = []
    prev_dash = False
    for ch in text.lower():
        if ch.isalnum():
            cleaned.append(ch)
            prev_dash = False
        elif not prev_dash:
            cleaned.append("-")
            prev_dash = True
    return "".join(cleaned).strip("-")
