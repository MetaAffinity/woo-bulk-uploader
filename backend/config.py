import json
from pathlib import Path

CONFIG_FILE = Path(__file__).parent.parent / "config.json"


def load_config() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    with open(CONFIG_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_config(data: dict) -> None:
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


class _Site:
    def __init__(self, cfg: dict):
        self.url = cfg["site_url"]
        self.wc_consumer_key = cfg["wc_consumer_key"]
        self.wc_consumer_secret = cfg["wc_consumer_secret"]
        self.wp_username = cfg.get("wp_username", "")
        self.wp_app_password = cfg.get("wp_app_password", "")


def get_site():
    cfg = load_config()
    if not cfg.get("site_url") or not cfg.get("wc_consumer_key"):
        return None
    return _Site(cfg)
