import csv, os, urllib.parse

base_dir = "/sessions/dreamy-fervent-ritchie/mnt/Beauty Instruments"
parent_cat = "Beauty Instruments"
img_prefix = "https://metaaffinity.net/desny/"

rows = []
for sub in sorted(os.listdir(base_dir)):
    sub_path = os.path.join(base_dir, sub)
    if not os.path.isdir(sub_path):
        continue
    for fname in sorted(os.listdir(sub_path)):
        if not fname.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue
        name_no_ext, ext = os.path.splitext(fname)
        if "_" not in name_no_ext:
            continue
        sku, prod_name = name_no_ext.split("_", 1)
        sku = sku.strip()
        prod_name = prod_name.strip()
        image_url = img_prefix + urllib.parse.quote(sub) + "/" + urllib.parse.quote(fname)
        categories = f"{parent_cat} > {sub}"
        rows.append({
            "Type": "simple",
            "SKU": sku,
            "Name": prod_name,
            "Published": 1,
            "Is featured?": 0,
            "Visibility in catalog": "visible",
            "Short description": "",
            "Description": "",
            "In stock?": 1,
            "Regular price": "",
            "Categories": categories,
            "Images": image_url,
        })

headers = ["Type","SKU","Name","Published","Is featured?","Visibility in catalog",
           "Short description","Description","In stock?","Regular price","Categories","Images"]

out_path = "woocommerce_products.csv"
with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=headers)
    w.writeheader()
    for r in rows:
        w.writerow(r)

print(f"Total products: {len(rows)}")
