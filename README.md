# Deal Scanner

A polite, alert-only restock and MSRP-price notifier for Pokémon TCG products.
It watches public product pages at Pokémon Center, Target, Walmart, Best Buy
(and any retailer that exposes schema.org `Product` JSON-LD), and pings you on
Discord or [ntfy](https://ntfy.sh) when something is in stock at or near MSRP.

You still click "Add to Cart" and check out yourself.

## What this is — and isn't

- **Is**: a watcher that reads public product pages, compares price to MSRP
  (with a configurable markup tolerance), and sends you a notification.
- **Isn't**: a checkout bot. It does not log in, add to cart, fill addresses,
  bypass CAPTCHAs, or evade rate limits. Those things violate retailer ToS,
  hurt other shoppers, and in many jurisdictions are illegal under
  computer-misuse laws. The scanner respects `robots.txt` and uses generous
  default poll intervals.

## Install

```bash
python -m venv .venv
. .venv/bin/activate
pip install -e .
```

## Configure

```bash
cp config.example.yaml config.yaml
# edit config.yaml: paste real product URLs, set MSRPs, add a Discord
# webhook URL or ntfy topic URL.
```

Set up notifications:
- **Discord**: in your server, *Server Settings → Integrations → Webhooks →
  New Webhook*, then copy the URL into `notifiers.discord_webhook_url`.
- **ntfy**: pick a hard-to-guess topic name, then set
  `notifiers.ntfy_topic_url` to `https://ntfy.sh/<your-topic>`. Subscribe to
  the same topic in the ntfy mobile/desktop app to receive pushes.

## Run

```bash
# Continuous polling
deal-scanner -c config.yaml

# One-shot (good for cron / GitHub Actions)
deal-scanner -c config.yaml --once
```

Verbose logging: `-v`.

## How matching works

For each configured product the scanner fetches the page and looks for the
schema.org `Product` JSON-LD that every major retailer embeds. From the
`offers` block it reads price, currency, and availability. An alert fires
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
implementation reuses `parse_jsonld_offers`. See `pokemoncenter.py` for the
shape.

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
