from deal_scanner.retailers.generic_jsonld import parse_jsonld_offers


HTML_IN_STOCK = """
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Surging Sparks Booster Box",
  "offers": {
    "@type": "Offer",
    "price": "161.64",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }
}
</script>
</head><body></body></html>
"""

HTML_OUT_OF_STOCK = """
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "offers": {
    "@type": "Offer",
    "price": "199.99",
    "priceCurrency": "USD",
    "availability": "https://schema.org/OutOfStock"
  }
}
</script>
</head></html>
"""

HTML_AGGREGATE = """
<html><head>
<script type="application/ld+json">
[
  {"@type": "BreadcrumbList"},
  {
    "@type": "Product",
    "offers": {
      "@type": "AggregateOffer",
      "lowPrice": "24.50",
      "priceCurrency": "USD",
      "availability": "InStock"
    }
  }
]
</script>
</head></html>
"""

HTML_NO_JSONLD = "<html><body><p>nothing</p></body></html>"


def test_in_stock_listing():
    listing = parse_jsonld_offers(HTML_IN_STOCK)
    assert listing is not None
    assert listing.in_stock is True
    assert listing.price == 161.64
    assert listing.currency == "USD"


def test_out_of_stock_listing():
    listing = parse_jsonld_offers(HTML_OUT_OF_STOCK)
    assert listing is not None
    assert listing.in_stock is False
    assert listing.price == 199.99


def test_aggregate_offer_uses_low_price():
    listing = parse_jsonld_offers(HTML_AGGREGATE)
    assert listing is not None
    assert listing.price == 24.50
    assert listing.in_stock is True


def test_missing_jsonld_returns_none():
    assert parse_jsonld_offers(HTML_NO_JSONLD) is None
