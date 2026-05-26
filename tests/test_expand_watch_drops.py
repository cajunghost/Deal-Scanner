from datetime import date

from deal_scanner.config import Config, WatchDropSpec, expand_watch_drops
from deal_scanner.drops import Drop


def _drop(**kw):
    base = dict(
        slug="bb",
        name="Booster Box",
        release_date=date(2026, 9, 1),
        msrp=161.64,
        links={
            "pokemoncenter": "https://www.pokemoncenter.com/x",
            "target": "https://www.target.com/x",
            "walmart": "https://www.walmart.com/x",
        },
    )
    base.update(kw)
    return Drop(**base)


def test_expands_to_one_product_per_retailer():
    cfg = Config(watch_drops=[WatchDropSpec(slug="bb")])
    drop = _drop()
    products = expand_watch_drops(cfg, {drop.slug: drop})
    retailers = sorted(p.retailer for p in products)
    assert retailers == ["pokemoncenter", "target", "walmart"]
    assert all(p.msrp == 161.64 for p in products)
    assert all(p.drop_slug == "bb" for p in products)


def test_retailer_subset_filters():
    cfg = Config(
        watch_drops=[WatchDropSpec(slug="bb", retailers=["pokemoncenter", "target"])]
    )
    drop = _drop()
    products = expand_watch_drops(cfg, {drop.slug: drop})
    assert sorted(p.retailer for p in products) == ["pokemoncenter", "target"]


def test_skips_when_drop_missing_or_no_msrp():
    cfg = Config(watch_drops=[WatchDropSpec(slug="missing")])
    assert expand_watch_drops(cfg, {}) == []

    no_msrp = _drop(msrp=None)
    cfg2 = Config(watch_drops=[WatchDropSpec(slug="bb")])
    assert expand_watch_drops(cfg2, {no_msrp.slug: no_msrp}) == []


def test_per_spec_overrides_carry_through():
    cfg = Config(
        watch_drops=[
            WatchDropSpec(slug="bb", max_markup_pct=5, poll_interval_seconds=300)
        ]
    )
    drop = _drop()
    products = expand_watch_drops(cfg, {drop.slug: drop})
    assert all(p.max_markup_pct == 5 for p in products)
    assert all(p.poll_interval_seconds == 300 for p in products)
