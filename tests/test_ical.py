from datetime import date

from deal_scanner.drops import Drop
from deal_scanner.ical import render_calendar


def _unfold(ics: str) -> str:
    # RFC 5545 line unfolding: a CRLF followed by a single space/tab is a
    # continuation of the previous line.
    return ics.replace("\r\n ", "").replace("\r\n\t", "")


def test_renders_calendar_with_event():
    drops = [
        Drop(
            slug="surging-sparks-bb",
            name="Surging Sparks BB",
            release_date=date(2026, 9, 1),
            msrp=161.64,
            notes="36-pack",
            links={
                "pokemoncenter": "https://www.pokemoncenter.com/x",
                "target": "https://www.target.com/x",
            },
        )
    ]
    ics = render_calendar(drops)
    assert ics.startswith("BEGIN:VCALENDAR")
    assert ics.rstrip().endswith("END:VCALENDAR")
    unfolded = _unfold(ics)
    assert "BEGIN:VEVENT" in unfolded
    assert "SUMMARY:Surging Sparks BB" in unfolded
    assert "DTSTART;VALUE=DATE:20260901" in unfolded
    assert "DTEND;VALUE=DATE:20260902" in unfolded
    assert "MSRP: $161.64" in unfolded
    assert "pokemoncenter: https://www.pokemoncenter.com/x" in unfolded
    # URL prop set to one of the retailer links
    assert "URL:https://" in unfolded


def test_skips_drops_without_dates():
    drops = [
        Drop(slug="a", name="A", release_date=None),
        Drop(slug="b", name="B", release_date=date(2026, 1, 1)),
    ]
    ics = render_calendar(drops)
    assert ics.count("BEGIN:VEVENT") == 1


def test_escapes_special_chars():
    drops = [
        Drop(
            slug="x",
            name="Name, with; commas",
            release_date=date(2026, 1, 1),
            notes="line1\nline2",
        )
    ]
    ics = render_calendar(drops)
    assert "SUMMARY:Name\\, with\\; commas" in ics
    assert "line1\\nline2" in ics
