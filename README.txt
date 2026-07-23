====================================
WooCommerce Bulk Uploader
====================================

FIRST TIME SETUP
----------------
1. Double-click setup.bat
   (needs Python and Node.js installed)

START THE APP
-------------
1. Double-click start.bat
2. Browser opens automatically at http://localhost:3000

FIRST USE
---------
1. Click "Settings" in the top navigation
2. Enter your WooCommerce site credentials:
   - Site URL         : https://yourstore.com
   - Consumer Key     : from WooCommerce > Settings > Advanced > REST API
   - Consumer Secret  : same place
   - WP Username      : your WordPress login name
   - App Password     : from WP Admin > Users > Your Profile > Application Passwords
3. Click "Test Connection" to verify
4. Click "Save Settings"

UPLOADING PRODUCTS
------------------
1. Organise your product images in folders:
   - Folder name = Category
   - Subfolder   = Subcategory (optional)
   - Filename format: SKU_Product-Name_Price.jpg
     e.g. FF728_Black-Belt_2500.jpg

2. Go to "Bulk Upload" page
3. Enter or browse to your folder path
4. (Optional) Set Auto-SKU prefix if images have no SKU
5. Click "Scan Folder" — preview appears
6. Click "Start Upload"

CHANGING SITES
--------------
Go to Settings and update the credentials to your other site.
Settings are saved in config.json in this folder.

CONFIG FILE FORMAT (config.json)
---------------------------------
{
  "site_url"          : "http://localhost/yoursite",
  "wc_consumer_key"   : "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "wc_consumer_secret": "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "wp_username"       : "admin",
  "wp_app_password"   : "xxxx xxxx xxxx xxxx xxxx xxxx"
}

UPLOAD OUTPUT
-------------
Each uploaded image creates a WooCommerce product with:
  - Name        : parsed from filename  (e.g. Black Belt)
  - SKU         : parsed from filename  (e.g. FF728)
  - Price       : parsed from filename  (e.g. 2500)
  - Category    : folder name           (e.g. Belts)
  - Subcategory : subfolder name        (if present)
  - Image       : uploaded to WordPress media library with SEO filename
  - Status      : published immediately

====================================
