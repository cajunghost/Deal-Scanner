from pathlib import Path

from deal_scanner.config import load_config


def test_load_config(tmp_path: Path):
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(
        """
default_poll_interval_seconds: 300
default_max_markup_pct: 5
user_agent: TestAgent/1.0
state_file: /tmp/state.json
respect_robots_txt: false
notifiers:
  discord_webhook_url: https://example.com/wh
products:
  - name: Test
    url: https://www.pokemoncenter.com/product/abc
    msrp: 99.99
    max_markup_pct: 15
  - name: Another
    url: https://www.target.com/p/xyz
    msrp: 19.99
"""
    )
    config = load_config(cfg_path)
    assert config.default_poll_interval_seconds == 300
    assert config.default_max_markup_pct == 5.0
    assert config.notifiers.discord_webhook_url == "https://example.com/wh"
    assert config.notifiers.ntfy_topic_url is None
    assert config.respect_robots_txt is False
    assert len(config.products) == 2
    assert config.products[0].msrp == 99.99
    assert config.products[0].max_markup_pct == 15
    assert config.products[1].max_markup_pct is None
