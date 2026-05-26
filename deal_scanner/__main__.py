from __future__ import annotations

import argparse
import logging
import sys

from .config import load_config
from .scanner import run


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="deal-scanner",
        description="Restock and MSRP-price notifier for Pokémon TCG products.",
    )
    parser.add_argument(
        "-c",
        "--config",
        default="config.yaml",
        help="Path to YAML config (default: config.yaml)",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable debug logging",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one check pass and exit (useful for cron/testing)",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    config = load_config(args.config)

    if args.once:
        from .scanner import _check_one, _Schedule
        from .state import State
        from .robots import RobotsCache
        import requests

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
            _check_one(s, config, session, state, robots)
        return 0

    run(config)
    return 0


if __name__ == "__main__":
    sys.exit(main())
