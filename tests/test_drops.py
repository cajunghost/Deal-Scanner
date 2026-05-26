from __future__ import annotations

from datetime import date
from pathlib import Path

from deal_scanner.drops import find_by_slug, load_drops, upcoming


def _write(tmp_path: Path, name: str, content: str) -> Path:
    p = tmp_path / name
    p.write_text(content)
    return p


def test_load_local_drops(tmp_path: Path):
    f = _write(
        tmp_path,
        "drops.yaml",
        """
drops:
  - slug: surging-sparks-bb
    name: "Surging Sparks Booster Box"
    release_date: 2026-09-01
    msrp: 161.64
    notes: "36-pack"
    links:
      pokemoncenter: https://www.pokemoncenter.com/x
      target: https://www.target.com/x
  - slug: no-date
    name: "Mystery Box"
    msrp: 99.99
""",
    )
    drops = load_drops(files=[f])
    assert len(drops) == 2
    bb = find_by_slug(drops, "surging-sparks-bb")
    assert bb is not None
    assert bb.release_date == date(2026, 9, 1)
    assert bb.msrp == 161.64
    assert "pokemoncenter" in bb.links
    assert bb.source == str(f)


def test_upcoming_filters_past_and_caps_window(tmp_path: Path):
    f = _write(
        tmp_path,
        "drops.yaml",
        """
drops:
  - slug: past
    name: Old
    release_date: 2020-01-01
  - slug: soon
    name: Soon
    release_date: 2030-01-15
  - slug: far
    name: Far
    release_date: 2099-01-01
""",
    )
    drops = load_drops(files=[f])
    today = date(2030, 1, 1)
    up = upcoming(drops, within_days=30, today=today)
    slugs = [d.slug for d in up]
    assert slugs == ["soon"]


def test_later_source_overrides_slug(tmp_path: Path):
    a = _write(
        tmp_path,
        "a.yaml",
        """
drops:
  - slug: x
    name: A
    release_date: 2026-01-01
    msrp: 10
""",
    )
    b = _write(
        tmp_path,
        "b.yaml",
        """
drops:
  - slug: x
    name: B
    release_date: 2026-02-01
    msrp: 20
""",
    )
    drops = load_drops(files=[a, b])
    assert len(drops) == 1
    assert drops[0].name == "B"
    assert drops[0].msrp == 20


def test_drops_sorted_by_release_date(tmp_path: Path):
    f = _write(
        tmp_path,
        "drops.yaml",
        """
drops:
  - slug: c
    name: C
    release_date: 2026-03-01
  - slug: a
    name: A
    release_date: 2026-01-01
  - slug: b
    name: B
    release_date: 2026-02-01
""",
    )
    drops = load_drops(files=[f])
    assert [d.slug for d in drops] == ["a", "b", "c"]


def test_malformed_entries_are_skipped(tmp_path: Path):
    f = _write(
        tmp_path,
        "drops.yaml",
        """
drops:
  - {}
  - slug: ok
    name: OK
    release_date: not-a-date
  - "not a dict"
""",
    )
    drops = load_drops(files=[f])
    assert len(drops) == 1
    assert drops[0].release_date is None
