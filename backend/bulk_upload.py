import re
import uuid
import json
import base64
import asyncio
from pathlib import Path
from typing import Dict, List, Optional, Any

import requests
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from config import get_site
from woo_client import WooCommerceClient

router = APIRouter(prefix="/bulk-upload", tags=["Bulk Upload"])

_sessions: Dict[str, dict] = {}

SESSIONS_DIR = Path(__file__).parent.parent / "sessions"


def _save_session(session_id: str) -> None:
    try:
        SESSIONS_DIR.mkdir(exist_ok=True)
        session = _sessions[session_id]
        products = session.get("products", [])
        pending = sum(1 for p in products if p["status"] == "pending")
        path = SESSIONS_DIR / f"{session_id}.json"
        if session.get("state") == "done" and pending == 0:
            path.unlink(missing_ok=True)
            return
        data = {"session_id": session_id, **session}
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass


def _load_sessions_from_disk() -> None:
    if not SESSIONS_DIR.exists():
        return
    for path in SESSIONS_DIR.glob("*.json"):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            session_id = data.pop("session_id", None)
            if not session_id:
                continue
            for p in data.get("products", []):
                if p.get("status") == "uploading":
                    p["status"] = "pending"
            if data.get("state") == "running":
                data["state"] = "done"
            data["cancelled"] = False
            _sessions[session_id] = data
        except Exception:
            pass

SUPPORTED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def _friendly_error(err: str, context: str = "") -> str:
    e = err.lower()
    if "already present in the lookup table" in e or ("duplicate" in e and "sku" in e):
        return None
    if "401" in e or "unauthorized" in e:
        if "wp-json" in e or "media" in e:
            return "WordPress login failed — check WP username & app password in Settings"
        return "WooCommerce API key invalid — check consumer key/secret in Settings"
    if "403" in e or "forbidden" in e:
        return "WooCommerce permission denied — API keys may be read-only, enable read+write"
    if "forcibly closed" in e or "connection aborted" in e or "connection reset" in e or "10054" in e:
        return ("Site blocked the request (connection reset) — a security plugin/firewall "
                "or hosting WAF is blocking the WooCommerce REST API. Whitelist /wp-json/ "
                "or your IP, and make sure the Site URL uses https")
    if "connectionerror" in e or "connection refused" in e or "max retries" in e:
        return "Could not connect to site — check that WordPress is running and URL is correct"
    if "timeout" in e or "timed out" in e:
        return "Request timed out — site is slow or unreachable, try again"
    if "413" in e or "request entity too large" in e:
        return "Image file too large — reduce file size or increase WordPress upload limit"
    if "415" in e or "unsupported media" in e:
        return "Image format not accepted by WordPress"
    if context == "image" and ("500" in e or "server error" in e):
        return "WordPress media upload failed (server error) — check WordPress error logs"
    if context == "image":
        return f"Image upload failed: {err[:150]}"
    if context == "category":
        if err.startswith("WooCommerce"):
            return f"Could not create category — {err[:280]}"
        return f"Could not create category in WooCommerce: {err[:200]}"
    if "500" in e or "internal server error" in e:
        return "WooCommerce server error — check WordPress/PHP error logs"
    if "404" in e:
        return "WooCommerce endpoint not found — verify site URL and WooCommerce is active"
    if "filenotfounderror" in e or "no such file" in e:
        return "Image file not found — file may have been moved or deleted"
    if err.startswith("WooCommerce"):
        return err
    return f"Upload error: {err[:200]}"


def _parse_filename(filename: str) -> dict:
    stem = Path(filename).stem
    parts = stem.split("_")
    sku: Optional[str] = None
    price: Optional[float] = None
    name_parts = list(parts)

    if name_parts and re.match(r"^[A-Za-z]{1,6}(-[A-Za-z]{1,6})*-?\d{1,8}$", name_parts[0]):
        sku = name_parts[0].upper()
        name_parts = name_parts[1:]

    if name_parts and re.match(r"^\d+$", name_parts[-1]):
        price = float(name_parts[-1])
        name_parts = name_parts[:-1]

    name = " ".join(name_parts).replace("-", " ").title()
    if not name.strip():
        name = stem.replace("-", " ").replace("_", " ").title()

    return {"sku": sku, "name": name, "price": price}


def _scan_folder(folder_path: str) -> List[dict]:
    root = Path(folder_path)
    if not root.exists() or not root.is_dir():
        return []

    items: List[dict] = []

    for img in sorted(root.iterdir()):
        if img.is_file() and img.suffix.lower() in SUPPORTED_EXT:
            parsed = _parse_filename(img.name)
            items.append({
                "file_path": str(img),
                "filename": img.name,
                "category": None,
                "subcategory": None,
                "subsubcategory": None,
                **parsed,
                "status": "pending",
                "wc_product_id": None,
                "error": None,
            })

    for cat_entry in sorted(root.iterdir()):
        if not cat_entry.is_dir():
            continue
        category = cat_entry.name.replace("-", " ").replace("_", " ").title()
        children = list(cat_entry.iterdir())
        subdirs = [c for c in children if c.is_dir()]
        images_direct = [c for c in children if c.is_file() and c.suffix.lower() in SUPPORTED_EXT]

        for img in sorted(images_direct):
            parsed = _parse_filename(img.name)
            items.append({
                "file_path": str(img),
                "filename": img.name,
                "category": category,
                "subcategory": None,
                "subsubcategory": None,
                **parsed,
                "status": "pending",
                "wc_product_id": None,
                "error": None,
            })

        for sub_entry in sorted(subdirs):
            subcategory = sub_entry.name.replace("-", " ").replace("_", " ").title()
            sub_children = list(sub_entry.iterdir())
            sub_subdirs = [c for c in sub_children if c.is_dir()]
            sub_images = [c for c in sub_children if c.is_file() and c.suffix.lower() in SUPPORTED_EXT]

            for img in sorted(sub_images):
                parsed = _parse_filename(img.name)
                items.append({
                    "file_path": str(img),
                    "filename": img.name,
                    "category": category,
                    "subcategory": subcategory,
                    "subsubcategory": None,
                    **parsed,
                    "status": "pending",
                    "wc_product_id": None,
                    "error": None,
                })

            for subsub_entry in sorted(sub_subdirs):
                subsubcategory = subsub_entry.name.replace("-", " ").replace("_", " ").title()
                for img in sorted(subsub_entry.iterdir()):
                    if img.is_file() and img.suffix.lower() in SUPPORTED_EXT:
                        parsed = _parse_filename(img.name)
                        items.append({
                            "file_path": str(img),
                            "filename": img.name,
                            "category": category,
                            "subcategory": subcategory,
                            "subsubcategory": subsubcategory,
                            **parsed,
                            "status": "pending",
                            "wc_product_id": None,
                            "error": None,
                        })

    return items


def _seo_filename(name: str, sku: Optional[str], ext: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if sku:
        sku_slug = re.sub(r"[^a-z0-9]+", "-", sku.lower()).strip("-")
        slug = f"{slug}-{sku_slug}"
    return f"{slug}{ext}"


def _upload_image_to_wp(site: Any, file_path: str, filename: str) -> int:
    url = f"{site.url.rstrip('/')}/wp-json/wp/v2/media"
    token = base64.b64encode(f"{site.wp_username}:{site.wp_app_password}".encode()).decode()
    ext = Path(filename).suffix.lower()
    mime = MIME_MAP.get(ext, "image/jpeg")
    with open(file_path, "rb") as f:
        r = requests.post(
            url,
            headers={
                "Authorization": f"Basic {token}",
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": mime,
            },
            data=f.read(),
            timeout=60,
        )
    if not r.ok:
        try:
            msg = r.json().get("message") or r.text[:200]
        except Exception:
            msg = r.text[:200]
        raise Exception(f"{r.status_code} {msg}")
    return r.json()["id"]


def _run_upload(session_id: str, site: Any) -> None:
    session = _sessions[session_id]
    wc = WooCommerceClient(site.url, site.wc_consumer_key, site.wc_consumer_secret)
    cat_cache: Dict[str, int] = {}

    for item in session["products"]:
        if item["status"] in ("created", "skipped"):
            continue

        if session.get("cancelled"):
            item["status"] = "skipped"
            continue

        if item.get("sku"):
            try:
                if wc.sku_exists(item["sku"]):
                    item["status"] = "skipped"
                    item["error"] = f"SKU {item['sku']} already exists in WooCommerce — skipped"
                    _save_session(session_id)
                    continue
            except Exception:
                pass

        item["status"] = "uploading"
        try:
            cat_id = None
            cat_key = ""
            if item.get("category"):
                cat_key = item["category"].lower()
                if cat_key not in cat_cache:
                    try:
                        cat_cache[cat_key] = wc.get_or_create_category(item["category"])
                    except Exception as e:
                        raise Exception(_friendly_error(str(e), context="category"))
                cat_id = cat_cache[cat_key]

            final_cat_id = cat_id
            if cat_id is not None and item.get("subcategory"):
                sub_key = f"{cat_key}/{item['subcategory'].lower()}"
                if sub_key not in cat_cache:
                    try:
                        cat_cache[sub_key] = wc.get_or_create_category(item["subcategory"], parent_id=cat_id)
                    except Exception as e:
                        raise Exception(_friendly_error(str(e), context="category"))
                final_cat_id = cat_cache[sub_key]

            if final_cat_id is not None and item.get("subsubcategory"):
                subsub_key = f"{cat_key}/{item.get('subcategory', '').lower()}/{item['subsubcategory'].lower()}"
                if subsub_key not in cat_cache:
                    try:
                        cat_cache[subsub_key] = wc.get_or_create_category(item["subsubcategory"], parent_id=final_cat_id)
                    except Exception as e:
                        raise Exception(_friendly_error(str(e), context="category"))
                final_cat_id = cat_cache[subsub_key]

            try:
                ext = Path(item["filename"]).suffix.lower()
                seo_name = _seo_filename(item["name"], item.get("sku"), ext)
                media_id = _upload_image_to_wp(site, item["file_path"], seo_name)
            except Exception as e:
                raise Exception(_friendly_error(str(e), context="image"))

            # Pick product name: most-specific category match → filename-parsed name
            cat_names = session.get("category_names", {})
            product_name = item["name"]
            if cat_names:
                parts = [p for p in [item.get("category"), item.get("subcategory"), item.get("subsubcategory")] if p]
                for i in range(len(parts), 0, -1):
                    key = " > ".join(parts[:i])
                    if key in cat_names and cat_names[key]:
                        product_name = cat_names[key]
                        break

            # Pick description: most-specific category match → global → empty
            cat_descs = session.get("category_descriptions", {})
            global_desc = session.get("global_description", "")
            description = ""
            if cat_descs:
                parts = [p for p in [item.get("category"), item.get("subcategory"), item.get("subsubcategory")] if p]
                for i in range(len(parts), 0, -1):
                    key = " > ".join(parts[:i])
                    if key in cat_descs and cat_descs[key]:
                        description = cat_descs[key]
                        break
            if not description:
                description = global_desc

            product_data: Dict[str, Any] = {
                "name": product_name,
                "status": "publish",
                "description": description,
                "categories": [{"id": final_cat_id}] if final_cat_id is not None else [],
                "images": [{"id": media_id}],
            }
            if item.get("sku"):
                product_data["sku"] = item["sku"]
            if item.get("price") is not None:
                product_data["regular_price"] = str(int(item["price"]))

            result = wc.create_product(product_data)
            item["wc_product_id"] = result["id"]
            item["status"] = "created"
            _save_session(session_id)

        except Exception as e:
            err = str(e)
            if "already present in the lookup table" in err.lower() or (
                "duplicate" in err.lower() and "sku" in err.lower()
            ):
                item["status"] = "skipped"
                item["error"] = f"SKU {item.get('sku', '')} already exists in WooCommerce — skipped"
            else:
                friendly = _friendly_error(err)
                item["status"] = "failed"
                item["error"] = friendly if friendly else err[:300]
            _save_session(session_id)

    session["state"] = "done"
    _save_session(session_id)


# ── API models ────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    folder_path: str
    sku_prefix: Optional[str] = None
    sku_start: int = 1
    force_sku: bool = False


class StartRequest(BaseModel):
    session_id: str
    global_description: str = ""
    category_descriptions: Dict[str, str] = {}
    category_names: Dict[str, str] = {}


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/scan")
def scan(req: ScanRequest):
    site = get_site()
    if not site:
        raise HTTPException(400, "No site configured — go to Settings and fill in your credentials first")

    products = _scan_folder(req.folder_path)

    if req.sku_prefix and req.sku_prefix.strip():
        prefix = req.sku_prefix.strip().upper()
        counter = req.sku_start
        for item in products:
            if not item["sku"] or req.force_sku:
                item["sku"] = f"{prefix}{str(counter).zfill(3)}"
                item["sku_auto"] = True
                counter += 1
            else:
                item["sku_auto"] = False
    else:
        for item in products:
            item["sku_auto"] = False

    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "folder_path": req.folder_path,
        "site_url": site.url,
        "state": "preview",
        "products": products,
        "cancelled": False,
    }
    return {
        "session_id": session_id,
        "products": products,
        "total": len(products),
    }


@router.post("/start")
def start_upload(req: StartRequest, background_tasks: BackgroundTasks):
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session["state"] == "running":
        raise HTTPException(400, "Already running")

    site = get_site()
    if not site:
        raise HTTPException(400, "No site configured — go to Settings first")

    session["state"] = "running"
    session["cancelled"] = False
    session["global_description"] = req.global_description.strip()
    session["category_descriptions"] = {k.strip(): v.strip() for k, v in req.category_descriptions.items()}
    session["category_names"] = {k.strip(): v.strip() for k, v in req.category_names.items()}
    background_tasks.add_task(_run_upload, req.session_id, site)
    return {"ok": True}


@router.get("/status/{session_id}")
def get_status(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    products = session["products"]
    counts = {
        "total": len(products),
        "created": sum(1 for p in products if p["status"] == "created"),
        "failed": sum(1 for p in products if p["status"] == "failed"),
        "uploading": sum(1 for p in products if p["status"] == "uploading"),
        "pending": sum(1 for p in products if p["status"] == "pending"),
        "skipped": sum(1 for p in products if p["status"] == "skipped"),
    }
    return {"state": session["state"], "products": products, **counts}


@router.get("/browse-folder")
def browse_folder():
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes("-topmost", True)
        folder = filedialog.askdirectory(title="Select Product Images Folder")
        root.destroy()
        if not folder:
            return {"path": None}
        return {"path": str(Path(folder))}
    except Exception as e:
        raise HTTPException(500, f"Could not open folder dialog: {e}")


@router.get("/image")
def serve_image(session_id: str = Query(...), path: str = Query(...)):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    folder = Path(session["folder_path"]).resolve()
    file = Path(path).resolve()
    try:
        file.relative_to(folder)
    except ValueError:
        raise HTTPException(403, "Path not allowed")
    if not file.is_file():
        raise HTTPException(404, "File not found")
    ext = file.suffix.lower()
    mime = MIME_MAP.get(ext, "image/jpeg")
    return Response(content=file.read_bytes(), media_type=mime)


_load_sessions_from_disk()


@router.delete("/{session_id}/product/{index}")
def remove_product(session_id: str, index: int):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session["state"] != "preview":
        raise HTTPException(400, "Cannot remove after upload has started")
    products = session["products"]
    if index < 0 or index >= len(products):
        raise HTTPException(400, "Invalid index")
    products.pop(index)
    return {"ok": True, "total": len(products)}


@router.post("/cancel/{session_id}")
def cancel_session(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    session["cancelled"] = True
    return {"ok": True}


@router.get("/export-csv/{session_id}")
def export_csv(session_id: str, image_base_url: str = Query("")):
    import csv, io, urllib.parse
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    headers = [
        "Type", "SKU", "Name", "Published", "Is featured?",
        "Visibility in catalog", "Short description", "Description",
        "In stock?", "Regular price", "Categories", "Images",
    ]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()

    base_url = image_base_url.rstrip("/") if image_base_url else ""
    root_folder = Path(session.get("folder_path", ""))

    for p in session["products"]:
        cats = [c for c in [p.get("category"), p.get("subcategory"), p.get("subsubcategory")] if c]
        category_str = " > ".join(cats)

        if base_url:
            try:
                rel = Path(p["file_path"]).relative_to(root_folder)
                rel_url = str(rel).replace("\\", "/")
                img_url = base_url + "/" + urllib.parse.quote(rel_url, safe="/")
            except (ValueError, KeyError):
                img_url = base_url + "/" + urllib.parse.quote(p["filename"])
        else:
            img_url = ""

        writer.writerow({
            "Type": "simple",
            "SKU": p.get("sku") or "",
            "Name": p["name"],
            "Published": 1,
            "Is featured?": 0,
            "Visibility in catalog": "visible",
            "Short description": "",
            "Description": "",
            "In stock?": 1,
            "Regular price": int(p["price"]) if p.get("price") else "",
            "Categories": category_str,
            "Images": img_url,
        })

    csv_bytes = output.getvalue().encode("utf-8-sig")
    output.close()

    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=woocommerce_products.csv"},
    )


@router.get("/incomplete")
def list_incomplete():
    result = []
    for sid, session in _sessions.items():
        if session.get("state") == "running":
            continue
        products = session.get("products", [])
        pending = sum(1 for p in products if p["status"] == "pending")
        if pending > 0:
            result.append({
                "session_id": sid,
                "folder_path": session.get("folder_path", ""),
                "site_url": session.get("site_url", ""),
                "total": len(products),
                "pending": pending,
                "created": sum(1 for p in products if p["status"] == "created"),
                "failed": sum(1 for p in products if p["status"] == "failed"),
            })
    return result


@router.post("/resume/{session_id}")
def resume_session(session_id: str, background_tasks: BackgroundTasks):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session["state"] == "running":
        raise HTTPException(400, "Already running")

    pending = [p for p in session["products"] if p["status"] == "pending"]
    if not pending:
        raise HTTPException(400, "No pending products to resume")

    site = get_site()
    if not site:
        raise HTTPException(400, "No site configured — go to Settings first")

    session_site = session.get("site_url", "").rstrip("/")
    current_site = site.url.rstrip("/")
    site_mismatch = session_site and session_site != current_site

    session["state"] = "running"
    session["cancelled"] = False
    background_tasks.add_task(_run_upload, session_id, site)
    return {"ok": True, "pending": len(pending), "site_mismatch": site_mismatch, "session_site": session_site}


@router.post("/retry/{session_id}")
def retry_failed(session_id: str, background_tasks: BackgroundTasks):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session["state"] == "running":
        raise HTTPException(400, "Upload already running")

    failed = [p for p in session["products"] if p["status"] == "failed"]
    if not failed:
        raise HTTPException(400, "No failed products to retry")

    site = get_site()
    if not site:
        raise HTTPException(400, "No site configured — go to Settings first")

    for p in failed:
        p["status"] = "pending"
        p["error"] = None

    session["state"] = "running"
    session["cancelled"] = False
    background_tasks.add_task(_run_upload, session_id, site)
    return {"ok": True}
