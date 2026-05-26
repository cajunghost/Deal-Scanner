from __future__ import annotations

import argparse
import logging
import sys
from datetime import date
from pathlib import Path

import requests

from .config import Config, expand_watch_drops, load_config
from .drops import Drop, load_drops, upcoming
from .ical import render_calendar
from .robots import RobotsCache
from .scanner import _check_one, _Schedule, run
from .state import State


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="deal-scanner",
        description="Restock alerts and release calendar for Pokémon TCG products.",
    )
    parser.add_argument(
        "-c", "--config", default="config.yaml",
        help="Path to YAML config (default: config.yaml)",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable debug logging"
    )

    sub = parser.add_subparsers(dest="command")

    p_watch = sub.add_parser("watch", help="Run the restock watcher")
    p_watch.add_argument(
        "--once",
        action="store_true",
        help="Run one check pass and exit (useful for cron/testing)",
    )

    p_drops = sub.add_parser(
        "drops", help="List or export the aggregated drop calendar"
    )
    p_drops.add_argument(
        "--days", type=int, default=None,
        help="Only show drops within the next N days",
    )
    p_drops.add_argument(
        "--all", action="store_true",
        help="Include past drops (default: upcoming only)",
    )
    p_drops.add_argument(
        "--ical", metavar="PATH",
        help="Write the calendar as an iCalendar (.ics) file at PATH",
    )
    p_drops.add_argument(
        "--json", action="store_true",
        help="Emit as JSON instead of a text table",
    )

    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    config = load_config(args.config)

    command = args.command or "watch"
    if command == "watch":
        return _cmd_watch(config, once=getattr(args, "once", False))
    if command == "drops":
        return _cmd_drops(
            config,
            days=args.days,
            include_past=args.all,
            ical_path=args.ical,
            as_json=args.json,
        )
    parser.print_help()
    return 2


def _load_all_drops(config: Config) -> list[Drop]:
    return load_drops(
        files=config.drops_files,
        urls=config.drops_urls,
        user_agent=config.user_agent,
    )


def _cmd_watch(config: Config, *, once: bool) -> int:
    drops = _load_all_drops(config)
    drops_by_slug = {d.slug: d for d in drops}

    expanded = expand_watch_drops(config, drops_by_slug)
    if expanded:
        seen_urls = {p.url for p in config.products}
        for p in expanded:
            if p.url not in seen_urls:
                config.products.append(p)
                seen_urls.add(p.url)

    if once:
        state = State(config.state_file)
        robots = (
            RobotsCache(config.user_agent) if config.respect_robots_txt else None
        )
        session = requests.Session()
        session.headers["User-Agent"] = config.user_agent
        for p in config.products:
            s = _Schedule(
                product=p,
                next_run=0.0,
                interval=float(
                    p.poll_interval_seconds
                    or config.default_poll_interval_seconds
                ),
                max_markup_pct=float(
                    p.max_markup_pct
                    if p.max_markup_pct is not None
                    else config.default_max_markup_pct
                ),
            )
            _check_one(s, config, session, state, robots, drops_by_slug)
        return 0

    run(config, drops_by_slug=drops_by_slug)
    return 0


def _cmd_drops(
    config: Config,
    *,
    days: int | None,
    include_past: bool,
    ical_path: str | None,
    as_json: bool,
) -> int:
    drops = _load_all_drops(config)
    if not include_past:
        drops = upcoming(drops, within_days=days)
    elif days is not None:
        from datetime import timedelta
        cutoff = date.today() + timedelta(days=days)
        drops = [d for d in drops if d.release_date and d.release_date <= cutoff]

    if ical_path:
        Path(ical_path).write_text(render_calendar(drops))
        print(f"Wrote {len(drops)} event(s) to {ical_path}")
        return 0

    if as_json:
        import json
        out = [
            {
                "slug": d.slug,
                "name": d.name,
                "release_date": d.release_date.isoformat() if d.release_date else None,
                "msrp": d.msrp,
                "notes": d.notes,
                "links": d.links,
                "source": d.source,
            }
            for d in drops
        ]
        print(json.dumps(out, indent=2))
        return 0

    _print_drops_table(drops)
    return 0


def _print_drops_table(drops: list[Drop]) -> None:
    if not drops:
        print("No drops found. Add entries to drops_files or drops_urls in config.")
        return
    today = date.today()
    for d in drops:
        if d.release_date:
            days_out = (d.release_date - today).days
            when = f"{d.release_date.isoformat()} ({_relative(days_out)})"
        else:
            when = "TBD"
        msrp = f"${d.msrp:.2f}" if d.msrp is not None else "—"
        print(f"\n• {d.name}")
        print(f"    when: {when}    MSRP: {msrp}    slug: {d.slug}")
        if d.notes:
            print(f"    notes: {d.notes}")
        if d.links:
            print("    buy:")
            for retailer, url in sorted(d.links.items()):
                print(f"      - {retailer:<16} {url}")


def _relative(days_out: int) -> str:
    if days_out == 0:
        return "today"
    if days_out == 1:
        return "tomorrow"
    if days_out > 0:
        return f"in {days_out}d"
    return f"{-days_out}d ago"


if __name__ == "__main__":
    sys.exit(main())
