# Scripts

## fetch_avatars.py

Download real X profile images via `unavatar.io/x/{handle}` into `public/images/avatars/`, and patch `avatars` on each product.

```bash
python3 scripts/fetch_avatars.py
```

## enrich_and_build.py

Enrich `data/products.json` from `raw/` replies + live product/GitHub pages, download covers into `public/images/products/`, sync `public/data/products.json`.

```bash
python3 scripts/enrich_and_build.py
```

## ingest_conversation.py

Incremental ingest notes for conversation `2115318655525523714` (merge check / sync public data). Does not create a monitoring routine.

```bash
python3 scripts/ingest_conversation.py --check
python3 scripts/ingest_conversation.py --sync-public
```

## generate-seo-pages.mjs

Post-`vite build`: write `dist/p/{slug}/index.html` shells with Chinese title/description/OG/JSON-LD.

## Frontend

```bash
npm install
npm run build   # vite + SEO pages → dist/
```

## Deploy (Workers assets)

```bash
npm run build
set -a; source /home/box/.cf_aitv.env; set +a
# wrangler.toml: [assets] directory = "./dist"; NO pages_build_output_dir
npx wrangler deploy --name aicodinghunt
```
