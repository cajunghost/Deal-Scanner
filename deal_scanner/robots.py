from __future__ import annotations

import logging
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

log = logging.getLogger(__name__)


class RobotsCache:
    def __init__(self, user_agent: str) -> None:
        self.user_agent = user_agent
        self._parsers: dict[str, RobotFileParser] = {}

    def can_fetch(self, url: str) -> bool:
        parsed = urlparse(url)
        host = f"{parsed.scheme}://{parsed.netloc}"
        rp = self._parsers.get(host)
        if rp is None:
            rp = RobotFileParser()
            rp.set_url(f"{host}/robots.txt")
            try:
                rp.read()
            except Exception as e:
                log.warning("Could not read robots.txt for %s: %s", host, e)
                self._parsers[host] = rp
                return True
            self._parsers[host] = rp
        try:
            return rp.can_fetch(self.user_agent, url)
        except Exception:
            return True
