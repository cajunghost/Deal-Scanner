# Deploy from your iPhone (no laptop required)

This guide gets restock and release-day pings landing on your iPhone in about
10 minutes. Everything is done in the **GitHub iOS app** + the **ntfy app**.

## What you'll end up with

- A cloud cron job (GitHub Actions free tier) that polls retailers every
  15 minutes and fires daily release-day notifications.
- Push notifications on your iPhone lock screen via ntfy, with one-tap
  retailer links in each alert.
- A drop calendar you can subscribe to from Apple Calendar.

## 1. Install the apps (2 min)

- **ntfy** — App Store: search "ntfy". Free, no signup.
- **GitHub** — App Store: search "GitHub". Sign in.

## 2. Make a private ntfy topic (1 min)

In the **ntfy app**:
1. Tap **+** to subscribe to a topic.
2. Server: `ntfy.sh` (default).
3. Topic name: pick something only you know — e.g. `pkmn-alerts-7f3kq8wp`.
   Anyone who guesses the name can send you alerts, so make it long and random.
4. Tap **Subscribe**.

Your topic URL is `https://ntfy.sh/pkmn-alerts-7f3kq8wp` (substitute your name).
Note it — you'll paste it in step 4.

In iOS Settings → Notifications → ntfy, turn on **Allow Notifications**,
**Lock Screen**, **Banners**, and **Sounds**.

## 3. Fork the repo (1 min)

In the **GitHub app**, open this repository and tap **Fork** (top-right
menu). Pick your account as the destination. Leave "Copy the default branch
only" checked.

## 4. Add your ntfy URL as a repo secret (2 min)

Still in the GitHub app, in your fork:
1. Tap the **⋯** menu → **Settings**.
   *(If Settings isn't visible in the mobile UI, tap "View on web" and use
   Safari — Settings → Secrets and variables → Actions is the destination.)*
2. **Secrets and variables** → **Actions** → **New repository secret**.
3. Name: `NTFY_TOPIC_URL`. Value: your full topic URL from step 2
   (`https://ntfy.sh/your-topic-name`). Tap **Add secret**.

Optional second secret:
- `DISCORD_WEBHOOK_URL` — paste a Discord webhook URL if you also want
  alerts in a Discord channel.

## 5. Enable Actions (30 sec)

In your fork:
1. Open the **Actions** tab.
2. If Actions are disabled on forks, GitHub will show an **I understand my
   workflows, go ahead and enable them** button — tap it.
3. Find the **Deal Scanner** workflow in the left sidebar.
4. Tap **Run workflow** → **Run workflow** to kick off an immediate test run.

Within ~2 minutes the run should complete green. If you have any drops with
a release date matching today, you'll get a push notification.

## 6. Add the products you actually care about (5 min)

The repo ships with `drops.catalog.yaml` — a seeded list of recent
Scarlet & Violet sets. To watch *your* specific products:

### From the iPhone

In the GitHub app, open `drops.catalog.yaml` and tap **Edit** (pencil icon).
Add a new entry at the bottom:

```yaml
  - slug: my-new-set-booster-box
    name: "Brand New Set — Booster Box"
    release_date: 2026-09-15
    msrp: 161.64
    links:
      pokemoncenter: "https://www.pokemoncenter.com/search?q=Brand+New+Set+Booster+Box"
      target:        "https://www.target.com/s?searchTerm=Brand+New+Set+Booster+Box"
      walmart:       "https://www.walmart.com/search?q=Brand+New+Set+Booster+Box"
      bestbuy:       "https://www.bestbuy.com/site/searchpage.jsp?st=Brand+New+Set+Booster+Box"
```

Commit the change. The next scheduled run picks it up automatically.

### From a laptop (faster for batch additions)

```bash
deal-scanner discover "Mega Evolution Booster Box" --yaml \
    --msrp 161.64 --release-date 2026-09-15
```

That prints a ready-to-paste stanza for `drops.catalog.yaml`.

## 7. (Optional) Subscribe to the drop calendar from Apple Calendar

From a laptop, run `deal-scanner -c config.yaml drops --ical drops.ics`,
commit `drops.ics` to your fork, and then in Apple Calendar add a
**New Calendar Subscription** pointed at the raw GitHub URL:

```
https://raw.githubusercontent.com/<your-username>/Deal-Scanner/<branch>/drops.ics
```

Calendar auto-refreshes daily.

## Troubleshooting

- **No notifications**: open the **Actions** tab and inspect the latest run
  log. Common cause: secret name is misspelled — must be exactly
  `NTFY_TOPIC_URL`.
- **Too many alerts**: lower the cron frequency in
  `.github/workflows/watch.yml` (change `*/15` to `*/30` for every
  half-hour), or raise `default_poll_interval_seconds` in the workflow's
  inline config.
- **Want to pause everything**: in the Actions tab, tap **Disable
  workflow**. Re-enable when ready.
- **Free-tier minutes**: public forks get unlimited Actions minutes.
  Private forks have a 2,000 min/month cap; every-15-minute polling fits
  inside that for typical job durations, but if you go private and run out,
  drop to `*/30`.

## What this doesn't do

This tool sends you alerts. It does not check out for you, log in, or solve
CAPTCHAs. You tap the link in the notification and complete the purchase
yourself — which is exactly the part that retailers' bot protections are
designed to ensure a human does.
