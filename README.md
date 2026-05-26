# Deal Scanner

Find extremely marked-down items (default: **70%+ off**) at Target, Walmart,
Home Depot, and Lowe's stores near you. Every result links straight to the
product page and the nearest store locator.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcajunghost%2Fdeal-scanner&project-name=deal-scanner&repository-name=deal-scanner&env=TARGET_REDSKY_KEY&envDescription=Target%27s+public+RedSky+client+key.+See+.env.example+for+the+current+default.)

Click the button, sign in to Vercel, accept the repo, and paste a
`TARGET_REDSKY_KEY` (or accept the default from `.env.example`). Vercel will
build and give you a `*.vercel.app` URL in under a minute.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
# open http://localhost:3000
```

Enter a 5-digit ZIP, pick retailers, hit **Scan**.

## Running locally for live data (residential IP)

Walmart, Home Depot, and Lowe's block requests from datacenter IPs (including
Vercel). Running locally from your home network usually works for all four
retailers — no proxy needed. Two ways:

**Web UI locally:**

```bash
npm run dev    # http://localhost:3000
```

**CLI (no browser):**

```bash
npm run scan -- --zip 90210
npm run scan -- --zip 90210 --pct 60 --retailers target,walmart
npm run scan -- --zip 90210 --html out/deals.html   # then open out/deals.html
npm run scan -- --zip 90210 --json out/deals.json
```

CLI flags:

| Flag                | Default  | Meaning                              |
| ------------------- | -------- | ------------------------------------ |
| `--zip <12345>`     | required | 5-digit ZIP code                     |
| `--pct <70>`        | 70       | Minimum markdown %                   |
| `--retailers <…>`   | all      | Comma-separated retailer list        |
| `--include-oos`     | off      | Include out-of-stock items           |
| `--html <path>`     | —        | Write an HTML report                 |
| `--json <path>`     | —        | Write raw JSON                       |
| `--timeout <ms>`    | 8000     | Per-adapter outbound timeout         |

## Using a residential proxy on the deployed app

If you'd rather not run locally, point `PROXY_URL` at any residential proxy
service in your Vercel environment variables:

```
PROXY_URL=http://USER:[email protected]:22225
```

Tested formats (any of these env names work: `PROXY_URL`, `HTTPS_PROXY`,
`HTTP_PROXY`):

| Provider     | URL pattern                                                                  |
| ------------ | ---------------------------------------------------------------------------- |
| Bright Data  | `http://brd-customer-XYZ-zone-residential:[email protected]:22225` |
| Oxylabs      | `http://customer-USER-cc-us:[email protected]:7777`                |
| IPRoyal      | `http://USER:[email protected]:12321`                  |
| Smartproxy   | `http://USER:[email protected]:10000`                       |

When the proxy is active, the UI shows a green **proxied** badge next to the
results header. All retailer fetches (Target included, even though it doesn't
need it) are routed through the proxy via [`undici.ProxyAgent`](https://undici.nodejs.org/#/docs/api/ProxyAgent).

## How it works

Each retailer has an adapter in `lib/adapters/`:

| Retailer    | Source                                                                          | Reliability |
| ----------- | ------------------------------------------------------------------------------- | ----------- |
| Target      | RedSky aggregation API + per-store fulfillment (clearance category `5xtg6`)     | High        |
| Walmart     | Parsed `__NEXT_DATA__` from the public clearance/flash-deals listing            | Fragile     |
| Home Depot  | `federation-gateway` GraphQL with clearance keyword, sorted by % off            | Fragile     |
| Lowe's      | Parsed JSON-LD product blocks from `/pl/Clearance/`                             | Fragile     |

Walmart, Home Depot, and Lowe's all sit behind heavy bot protection (Akamai /
PerimeterX). When an adapter is blocked the API returns sample data for that
retailer and surfaces the underlying error in the UI, so the page is never
empty.

### Markdown threshold

The threshold is enforced on the server (`lib/filters.ts`) and is configurable
in the UI from 50% to 95% in 5% increments. Default is 70%.

### In-stock check

- **Target**: uses `fulfillment.store_options[].in_store_only` /
  `order_pickup.availability_status == "IN_STOCK"` at the ZIP's nearest store.
- **Walmart / HD / Lowe's**: uses the availability field from the listing
  response. Walmart's listing does not always include per-store inventory, so
  in-stock can be optimistic — the deep link goes to the PDP where you can
  check the assigned store.

### Links

Each card links to:

- The **product page** (PDP) on the retailer's site.
- The **store locator** for that retailer pre-filtered to your ZIP.

## Configuration (`.env.local`)

- `TARGET_REDSKY_KEY` — public client key Target.com uses. Rotates
  occasionally; if you see auth errors, grab the current one from a
  `redsky.target.com` request on target.com.
- `TARGET_VISITOR_ID` — optional. If unset, a random 32-hex ID is generated
  per request.
- `DEAL_SCANNER_MOCK=1` — force mock data for all retailers (useful for UI
  development).
- `DEAL_SCANNER_TIMEOUT_MS` — per-adapter outbound timeout in ms (default
  8000).

## Project layout

```
app/
  page.tsx              # Search form + results grid
  api/scan/route.ts     # POST /api/scan -> aggregated results
lib/
  types.ts              # Deal, ScanRequest, Adapter
  http.ts               # fetchJson/fetchText with timeout, UA, optional proxy
  filters.ts            # threshold + sort
  adapters/
    target.ts
    walmart.ts
    homedepot.ts
    lowes.ts
    mock.ts             # sample data fallback
    index.ts            # registry
scripts/
  scan.ts               # CLI: same adapters, pretty terminal output + HTML
```

## Notes & caveats

- This tool calls retailer endpoints that they expose to their own web
  clients. The endpoints may change without notice. Treat output as a lead,
  not a guarantee — call ahead before driving anywhere for a unit.
- The app is read-only and rate-limited by your own outbound capacity; it
  performs no scraping at scale.
- Per-store pricing accuracy is best on Target (their API returns it
  natively). Walmart/HD/Lowe's often show the national online price; the
  in-store register may differ.

## Scripts

```bash
npm run dev        # local dev server
npm run build      # production build
npm run start      # serve built app
npm run typecheck  # tsc --noEmit
```
