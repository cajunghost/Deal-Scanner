# Deal Scanner

A polite, alert-only restock and MSRP-price notifier for Pokémon TCG products,
with an aggregated **drop calendar** that gives you quick-purchase links across
Pokémon Center, Target, Walmart, Best Buy, and any other retailer you add.

You still click "Add to Cart" and check out yourself. There is no automated
checkout and no anti-bot evasion in this project.

## What you get

- **`deal-scanner watch`** — polls public product pages, alerts on Discord or
  [ntfy](https://ntfy.sh) when price ≤ MSRP × (1 + your markup tolerance) and
  the item is in stock. Alerts include "Also try:" links to every other
  retailer that carries the same drop.
- **`deal-scanner drops`** — prints the upcoming-release calendar with one
  buy link per retailer per drop. Can export the same data as an
  iCalendar (`.ics`) file you subscribe to from your phone/desktop calendar.
- **`deal-scanner notify-drops`** — fires release-day push notifications
  with one-tap retailer links. Run daily via cron or GitHub Actions.
- **`deal-scanner discover "Set Name"`** — prints (or emits as YAML) the
  retailer search URLs for any product. Filling in the catalog is ~10 sec
  per entry.
- **Aggregation** — merges local YAML drop files with remote YAML/JSON URLs
  so you can subscribe to community-curated lists.
- **Auto-watch from the calendar** — list a drop slug under `watch_drops`
  and it expands into one watched product per retailer link.
- **iPhone-friendly deploy** — see [IPHONE_DEPLOY.md](IPHONE_DEPLOY.md).
  Fork → add ntfy URL as a repo secret → enable Actions. 10 minutes,
  no laptop required.

## Pre-seeded catalog

`drops.catalog.yaml` ships with the Scarlet & Violet era sets (booster
boxes, ETBs, bundles, plus special sets like Pokémon 151, Paldean Fates,
and Prismatic Evolutions) using durable retailer search URLs as the buy
links. Pull updates with `git pull`; add your own entries in a personal
`drops.yaml` (gitignored).

## Install

```bash
python -m venv .venv
. .venv/bin/activate
pip install -e .
```

## Configure

```bash
cp config.example.yaml config.yaml
cp drops.example.yaml drops.yaml
# edit drops.yaml: real release dates, retailer URLs, MSRPs
# edit config.yaml: notification webhook, watch_drops list
```

Set up notifications:
- **Discord**: *Server Settings → Integrations → Webhooks → New Webhook*, copy
  the URL into `notifiers.discord_webhook_url`.
- **ntfy**: pick a hard-to-guess topic, set
  `notifiers.ntfy_topic_url` to `https://ntfy.sh/<your-topic>`, and subscribe
  to the same topic in the ntfy mobile/desktop app.

## Run

### Watcher

```bash
deal-scanner watch                    # continuous polling
deal-scanner watch --once             # one pass and exit (cron / Actions)
deal-scanner -v watch                 # debug logging
```

Alerts that fire for a product with a `drop_slug` (set automatically when the
product came from `watch_drops`) include the full retailer link list, so when
the alert lands on your phone you can tap any retailer to try them in order.

### Drop calendar

```bash
deal-scanner drops                    # upcoming drops with buy links
deal-scanner drops --days 30          # next 30 days only
deal-scanner drops --all              # include past releases too
deal-scanner drops --json             # machine-readable
deal-scanner drops --ical drops.ics   # export as iCalendar
```

### Release-day notifications

```bash
deal-scanner notify-drops             # pings any drop launching today
deal-scanner notify-drops --lookahead 1   # also include tomorrow
```

State-deduped: re-running on the same day won't double-alert.

### Discover (add products fast)

```bash
deal-scanner discover "Mega Evolution Booster Box"
# pokemoncenter  https://www.pokemoncenter.com/search?q=...
# target         https://www.target.com/s?searchTerm=...
# ...

deal-scanner discover "Mega Evolution Booster Box" --yaml \
    --msrp 161.64 --release-date 2026-09-15
# emits a ready-to-paste drops.catalog.yaml entry
```

To subscribe to the `.ics` file from your calendar app, serve it from a URL
(GitHub Pages, an S3 bucket, your own server) and add it as a calendar
subscription — most apps auto-refresh.

## Drop calendar schema

A drops file is YAML (or JSON) with a top-level `drops:` list. Each entry:

```yaml
drops:
  - slug: surging-sparks-bb         # stable identifier; used by watch_drops
    name: "Surging Sparks Booster Box"
    release_date: 2026-09-01        # YYYY-MM-DD
    msrp: 161.64
    notes: "36-pack booster box"
    links:
      pokemoncenter: "https://www.pokemoncenter.com/..."
      target: "https://www.target.com/..."
      walmart: "https://www.walmart.com/..."
      bestbuy: "https://www.bestbuy.com/..."
```

`config.yaml` references one or more sources:

```yaml
drops_files:
  - drops.yaml
drops_urls:
  - https://raw.githubusercontent.com/some-user/pokemon-drops/main/drops.yaml
```

Later sources override earlier ones on slug collision.

## How matching works

For each watched product the scanner fetches the page and reads the
schema.org `Product` JSON-LD that every major retailer embeds. From the
`offers` block it pulls price, currency, and availability. An alert fires
when **all** of these hold:

- `availability` indicates in-stock (`InStock`, `OnlineOnly`,
  `LimitedAvailability`, `PreOrder`).
- `price` ≤ `msrp × (1 + max_markup_pct/100)`.
- We haven't already alerted for the current "favorable" run.

When the item goes out of stock or the price climbs back above the
threshold, the alert state resets so the next favorable transition pings
again.

## Add a retailer

Drop a module in `deal_scanner/retailers/` exposing a class with `name: str`
and `fetch(url, session) -> Listing`. Register it in
`deal_scanner/retailers/__init__.py` against its hostname(s). The simplest
implementation reuses `parse_jsonld_offers` (see `pokemoncenter.py`).

## Test

```bash
pip install pytest
pytest
```

## Etiquette / legal

- Keep `default_poll_interval_seconds` at 5+ minutes. Hammering retailer
  product pages will get your IP throttled, blocked, or worse, and it
  degrades the experience for actual shoppers.
- Leave `respect_robots_txt: true`. If a retailer says "don't scrape this
  path," don't.
- You are responsible for your use of this tool. Bypassing access controls
  (CAPTCHAs, anti-bot challenges) or violating a site's Terms of Service
  may be unlawful where you live; this project does not do those things
  and will not accept changes that do.
