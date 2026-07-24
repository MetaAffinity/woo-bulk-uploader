import base64
import requests as _requests
from fastapi import APIRouter
from pydantic import BaseModel
from config import load_config, save_config, get_site
from woo_client import WooCommerceClient

router = APIRouter(prefix="/settings", tags=["Settings"])


class SiteConfig(BaseModel):
    site_url: str
    wc_consumer_key: str
    wc_consumer_secret: str
    wp_username: str
    wp_app_password: str


def _test_wp_auth(site_url: str, username: str, app_password: str) -> dict:
    if not username or not app_password:
        return {"ok": False, "error": "WP Username or Application Password is empty."}
    try:
        credentials = base64.b64encode(f"{username}:{app_password}".encode()).decode()
        url = f"{site_url.rstrip('/')}/wp-json/wp/v2/users/me"
        r = _requests.get(url, headers={"Authorization": f"Basic {credentials}"}, timeout=15)
        if r.status_code == 200:
            return {"ok": True, "error": ""}
        if r.status_code == 401:
            try:
                code = r.json().get("code", "")
            except Exception:
                code = ""
            if "application-passwords-disabled" in code:
                return {"ok": False, "error": (
                    "Application Passwords are disabled on this WordPress site. "
                    "Add this to functions.php to enable them:\n"
                    "add_filter('wp_is_application_passwords_available', '__return_true');"
                )}
            return {"ok": False, "error": (
                "Application Password is incorrect. "
                "Go to WP Admin → Users → Your Profile → Application Passwords → generate a new one."
            )}
        if r.status_code == 404:
            return {"ok": False, "error": "WordPress REST API not reachable. Check your Site URL."}
        return {"ok": False, "error": f"Unexpected response from WordPress: HTTP {r.status_code}"}
    except Exception as e:
        return {"ok": False, "error": f"Could not reach WordPress: {e}"}


@router.get("")
def get_settings():
    return load_config()


@router.post("")
def save_settings(cfg: SiteConfig):
    save_config(cfg.model_dump())
    return {"ok": True}


@router.post("/test")
def test_connection():
    cfg = load_config()
    site = get_site()
    if not site:
        return {"ok": False, "wc_ok": False, "wp_ok": False,
                "wc_error": "No site configured — fill in Settings first", "wp_error": ""}

    wc = WooCommerceClient(site.url, site.wc_consumer_key, site.wc_consumer_secret)
    wc_result = wc.test_connection()

    wp_result = _test_wp_auth(
        site.url,
        cfg.get("wp_username", ""),
        cfg.get("wp_app_password", ""),
    )

    return {
        "ok": wc_result["ok"] and wp_result["ok"],
        "wc_ok": wc_result["ok"],
        "wc_error": wc_result.get("error", ""),
        "wp_ok": wp_result["ok"],
        "wp_error": wp_result.get("error", ""),
    }
