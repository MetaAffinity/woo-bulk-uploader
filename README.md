# WooCommerce Bulk Uploader

A standalone desktop app to bulk-upload product images to WooCommerce. Separate from the main AI SEO Agent — designed to be shared with a colleague without giving access to the full SEO system.

**Developed by:** Muhammad Imran · metaaffinity.net

---

## Setup & Run

### First time only
Double-click `setup.bat` — installs Python packages and frontend dependencies.

### Every time
Double-click `start.bat` — starts backend + frontend and opens the browser automatically at `http://localhost:3000`.

---

## Features

### Bulk Upload
- Scans a local folder of product images
- Parses product Name, SKU, and Price from the filename
- Uploads image to WordPress media library with an SEO-friendly filename
- Creates the product in WooCommerce with category, subcategory (up to 3 levels), price, and SKU
- Preview all products before uploading — remove unwanted items from the list
- Live progress tracking during upload

### Filename Format
| Filename | Result |
|---|---|
| `FF728_belt-black_2500.jpg` | Name: Belt Black · SKU: FF728 · Price: 2500 |
| `FF728_belt-black.jpg` | Name: Belt Black · SKU: FF728 · Price: — |
| `belt-black_2500.jpg` | Name: Belt Black · SKU: auto/— · Price: 2500 |
| `belt-black.jpg` | Name: Belt Black · SKU: auto/— · Price: — |

### Folder Structure → Categories
```
📁 D:\products\
  📁 Hoodies\              ← Category
    📁 Fleece\             ← Subcategory
      📁 Winter\           ← Sub-subcategory
        FF728_item_2500.jpg
  📁 Gloves\
    item_1200.jpg
```

### Auto-SKU Generation
If images have no SKU in the filename, set a prefix (e.g. `FF`) and starting number. SKUs are auto-assigned: `FF001`, `FF002`, `FF003`...

### Skip Already-Uploaded
Before each upload, the app checks WooCommerce via the API. If the SKU already exists, the product is skipped automatically — no duplicates created.

### Retry Failed
After an upload completes, if any products failed a **Retry Failed** button appears. Only the failed products are re-attempted — already-created ones are untouched.

### Active Site Indicator
The Bulk Upload page header always shows the currently configured site URL (green dot + URL). You always know which site products will upload to before starting.

### Resume Interrupted Upload
If the app closes, power goes off, or the system restarts mid-upload, progress is saved to disk automatically after every product. On next launch, an **orange resume banner** appears showing how many products were completed and how many remain. Click **Resume** to continue from where it stopped.

**Site mismatch protection:** The session remembers which site it was uploading to. If you change the site in Settings and then try to resume, a **red warning** appears:
> "Warning: This session was for `localhost/site-A` but current site is `localhost/site-B`. Resuming will upload to the current site."

This prevents accidentally uploading products to the wrong site after a restart.

### WC Product Links
After upload, each product's WooCommerce ID is a clickable link that opens the product edit page in WP Admin directly.

### Settings
Credentials are stored in `config.json` at the project root.

```json
{
  "site_url"          : "http://localhost/yoursite",
  "wc_consumer_key"   : "ck_...",
  "wc_consumer_secret": "cs_...",
  "wp_username"       : "admin",
  "wp_app_password"   : "xxxx xxxx xxxx xxxx xxxx xxxx"
}
```

Use **Test Connection** to verify credentials before uploading.

---

## Troubleshooting

### "Could not create category … Expecting value: line 1 column 1 (char 0)"
This means WooCommerce replied with an **empty body or an HTML page instead of JSON** — the REST API request never reached WooCommerce properly. Common on **live sites** (works on localhost) because of:

1. **Wrong Site URL scheme** — if the live site forces `https://` but Settings has `http://` (or www vs non-www), the request is redirected and the JSON is lost. Fix: set the Site URL in Settings to the exact address the browser shows (usually `https://yourdomain.com`, no trailing slash).
2. **Permalinks set to "Plain"** — the REST API only works with pretty permalinks. Fix: `WP Admin → Settings → Permalinks → Post name → Save`.
3. **Security plugin / firewall / Cloudflare** (Wordfence, iThemes, etc.) blocking `/wp-json/`. Fix: whitelist the REST API or your IP.

The app now shows the real cause in the error message (HTTP status + whether it was redirected or returned a web page) so you can tell which of the above it is.

### "Connection forcibly closed" / ConnectionResetError (WinError 10054)
The live server **reset the connection** — something is blocking the WooCommerce REST API request. Causes & fixes:

1. **Keys-in-URL tripping a firewall** — the app now sends API keys in the `Authorization` header (Basic auth) automatically on `https://` sites instead of in the URL query string, which prevents most WAFs from resetting the connection. Make sure the Site URL in Settings starts with `https://`.
2. **Security plugin / hosting WAF** (Wordfence, ModSecurity, Cloudflare) blocking POST requests to `/wp-json/`. Fix: whitelist the REST API or your IP, or temporarily disable the security plugin while uploading.
3. Ask your host to whitelist REST API write requests if it persists.

---

## Credentials Setup

### WooCommerce API Keys
`WooCommerce → Settings → Advanced → REST API → Add key`
- Set permission to **Read/Write**
- Copy Consumer Key and Consumer Secret

### WordPress Application Password
`WP Admin → Users → Your Profile → Application Passwords → Add New`
- Enter any name, click Add New, copy the generated password

> **Localhost only:** Application Passwords are disabled by default on local WordPress.
> Add this line to your theme's `functions.php` to enable them:
> ```php
> add_filter('wp_is_application_passwords_available', '__return_true');
> ```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI (Python 3.12), Uvicorn, port 8000 |
| Frontend | Next.js 15, Tailwind CSS, port 3000 |
| Storage | `config.json` (credentials) · `sessions/` folder (upload progress) |
| WooCommerce | REST API v3 via `woocommerce` Python package |

### Key Files
| File | Purpose |
|---|---|
| `backend/main.py` | FastAPI app entry point |
| `backend/bulk_upload.py` | All upload logic, session management, API routes |
| `backend/settings_route.py` | GET/POST /settings + test connection |
| `backend/config.py` | Reads/writes config.json |
| `backend/woo_client.py` | WooCommerce REST API client |
| `frontend/app/bulk-upload/page.tsx` | Main upload UI |
| `frontend/app/settings/page.tsx` | Credentials form |
| `frontend/lib/api.ts` | All frontend API calls |
| `config.json` | Site credentials (auto-created on first save) |
| `sessions/` | Interrupted upload progress (auto-managed) |
