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


@router.get("")
def get_settings():
    return load_config()


@router.post("")
def save_settings(cfg: SiteConfig):
    save_config(cfg.model_dump())
    return {"ok": True}


@router.post("/test")
def test_connection():
    site = get_site()
    if not site:
        return {"ok": False, "error": "No site configured — fill in Settings first"}
    wc = WooCommerceClient(site.url, site.wc_consumer_key, site.wc_consumer_secret)
    return wc.test_connection()
