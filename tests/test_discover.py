from deal_scanner.discover import search_urls, slugify


def test_search_urls_returns_all_retailers_by_default():
    urls = search_urls("Surging Sparks Booster Box")
    assert "pokemoncenter" in urls
    assert "target" in urls
    assert "walmart" in urls
    assert "bestbuy" in urls
    # Each URL must encode the query (quote_plus uses + for spaces).
    for url in urls.values():
        assert "Surging+Sparks+Booster+Box" in url


def test_retailer_subset():
    urls = search_urls("151 ETB", retailers=["pokemoncenter", "target"])
    assert set(urls) == {"pokemoncenter", "target"}


def test_slugify():
    assert slugify("Surging Sparks Booster Box") == "surging-sparks-booster-box"
    assert slugify("Pokémon 151 — ETB!") == "pokémon-151-etb"
    assert slugify("   leading/trailing   ") == "leading-trailing"
