from woocommerce import API
from typing import List, Dict, Any, Optional
import requests


def _parse_json(r, action: str):
    """Parse a WooCommerce response as JSON, or raise a clear, human error.

    WooCommerce sometimes replies with an empty body or an HTML page (200 OK)
    instead of JSON — usually because permalinks are set to "Plain", the URL is
    being redirected (http→https / www), or a security plugin/firewall blocked
    the REST API. In those cases json() throws the cryptic
    'Expecting value: line 1 column 1 (char 0)'. Turn it into something useful.
    """
    try:
        return r.json()
    except Exception:
        body = (r.text or "").strip()
        # Detect the common root causes so the message is actionable.
        redirected = bool(getattr(r, "history", None))
        looks_html = body[:1] in ("<",) or "<!doctype" in body[:200].lower() or "<html" in body[:200].lower()
        hint = ""
        if not body:
            hint = "empty response from server"
        elif looks_html:
            hint = ("server returned a web page instead of JSON — likely WordPress "
                    "Permalinks are set to 'Plain' (change to 'Post name'), or a "
                    "security plugin/firewall is blocking the REST API")
        if redirected:
            final = getattr(r, "url", "")
            hint = (hint + "; " if hint else "") + f"the request was redirected to {final} — check the Site URL (http vs https, www)"
        snippet = body[:200].replace("\n", " ")
        detail = hint or f"non-JSON response: {snippet}"
        raise Exception(f"WooCommerce {action} — HTTP {r.status_code}: {detail}")


class WooCommerceClient:
    def __init__(self, site_url: str, consumer_key: str, consumer_secret: str):
        self.url = site_url.rstrip("/")
        # On https, use standard header-based Basic auth (the WooCommerce default).
        # Putting the ck/cs keys in the URL query string (query_string_auth) is only
        # needed on plain-http localhost, where servers strip the Authorization
        # header. On a live https site, keys-in-URL trips many firewalls/WAFs and
        # causes 'connection forcibly closed' (WinError 10054) resets, so avoid it.
        is_https = self.url.lower().startswith("https://")
        self.wcapi = API(
            url=self.url,
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            version="wc/v3",
            timeout=60,
            query_string_auth=not is_https,
        )

    def test_connection(self) -> dict:
        result = {"ok": False, "read": False, "write": False, "error": ""}
        try:
            r = self.wcapi.get("products", params={"per_page": 1})
            result["read"] = r.status_code == 200
        except Exception as e:
            result["error"] = str(e)
            return result

        try:
            r2 = self.wcapi.put("products/0", {})
            result["write"] = r2.status_code != 401
        except Exception:
            result["write"] = True

        result["ok"] = result["read"] and result["write"]
        if not result["write"]:
            result["error"] = "API key is Read-only. Regenerate with Read/Write permission."
        return result

    def create_product(self, data: Dict[str, Any]) -> Dict:
        r = self.wcapi.post("products", data)
        if not r.ok:
            try:
                body = r.json()
                msg = body.get("message") or body.get("code") or r.text[:300]
            except Exception:
                msg = r.text[:300]
            raise Exception(f"WooCommerce {r.status_code}: {msg}")
        return r.json()

    def sku_exists(self, sku: str) -> bool:
        try:
            r = self.wcapi.get("products", params={"sku": sku, "per_page": 1})
            data = r.json()
            return isinstance(data, list) and len(data) > 0
        except Exception:
            return False

    def get_or_create_category(self, name: str, parent_id: Optional[int] = None) -> int:
        params: Dict[str, Any] = {"search": name, "per_page": 100, "hide_empty": False}
        if parent_id is not None:
            params["parent"] = parent_id
        r = self.wcapi.get("products/categories", params=params)
        existing = _parse_json(r, "reading categories")
        if isinstance(existing, list):
            for cat in existing:
                if cat["name"].strip().lower() == name.strip().lower():
                    if parent_id is None or cat.get("parent", 0) == parent_id:
                        return cat["id"]
        payload: Dict[str, Any] = {"name": name}
        if parent_id is not None:
            payload["parent"] = parent_id
        r = self.wcapi.post("products/categories", payload)
        body = _parse_json(r, "creating category")
        if not r.ok:
            msg = body.get("message") or body.get("code") if isinstance(body, dict) else str(body)[:200]
            raise Exception(f"WooCommerce {r.status_code}: {msg}")
        return body["id"]
