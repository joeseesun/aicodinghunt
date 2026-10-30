# Scripts

## enrich_and_build.py

Enrich `data/products.json` from `raw/` replies + live product/GitHub pages, download covers into `public/images/products/`, and rebuild:

- `public/data/products.json`
- index (cards + 点赞榜 / 浏览榜 tabs)
- static detail pages at `public/p/{slug}/index.html`

```bash
python3 scripts/enrich_and_build.py
```

## Deploy (Workers assets — verified)

```bash
source /home/box/.cf_aitv.env
rm -rf /tmp/aicodinghunt-worker && mkdir -p /tmp/aicodinghunt-worker
cp -a public /tmp/aicodinghunt-worker/
cat > /tmp/aicodinghunt-worker/wrangler.toml <<'TOML'
name = "aicodinghunt"
compatibility_date = "2026-10-01"
workers_dev = true
[assets]
directory = "./public"
not_found_handling = "single-page-application"
TOML
cd /tmp/aicodinghunt-worker && npx wrangler deploy
```

Custom domain `aicodinghunt.qiaomu.ai` is already attached.

`build_worker_upload.py` — emergency embedded Worker multipart upload if Pages/Workers permissions are missing.
