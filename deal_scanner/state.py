from __future__ import annotations

import json
from pathlib import Path
from threading import Lock


class State:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self._lock = Lock()
        if self.path.exists():
            self._data = json.loads(self.path.read_text() or "{}")
        else:
            self._data = {}

    def get_alerted(self, key: str) -> bool:
        return bool(self._data.get(key, {}).get("alerted"))

    def set_alerted(self, key: str, alerted: bool) -> None:
        with self._lock:
            entry = self._data.setdefault(key, {})
            entry["alerted"] = alerted
            self._flush()

    def _flush(self) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(self._data, indent=2))
        tmp.replace(self.path)
