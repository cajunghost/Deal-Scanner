from __future__ import annotations

import logging

import requests

from .config import Notifiers

log = logging.getLogger(__name__)


def send_alert(
    notifiers: Notifiers,
    *,
    title: str,
    message: str,
    url: str,
) -> None:
    if notifiers.discord_webhook_url:
        _send_discord(notifiers.discord_webhook_url, title, message, url)
    if notifiers.ntfy_topic_url:
        _send_ntfy(notifiers.ntfy_topic_url, title, message, url)
    if not notifiers.discord_webhook_url and not notifiers.ntfy_topic_url:
        log.warning("No notifiers configured; logging alert only")
    log.info("ALERT %s — %s — %s", title, message, url)


def _send_discord(webhook: str, title: str, message: str, url: str) -> None:
    payload = {
        "embeds": [
            {
                "title": title,
                "description": message,
                "url": url,
            }
        ]
    }
    try:
        r = requests.post(webhook, json=payload, timeout=10)
        r.raise_for_status()
    except requests.RequestException as e:
        log.error("Discord notification failed: %s", e)


def _send_ntfy(topic_url: str, title: str, message: str, url: str) -> None:
    try:
        r = requests.post(
            topic_url,
            data=message.encode("utf-8"),
            headers={
                "Title": title,
                "Click": url,
                "Tags": "money_with_wings",
            },
            timeout=10,
        )
        r.raise_for_status()
    except requests.RequestException as e:
        log.error("ntfy notification failed: %s", e)
