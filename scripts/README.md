# Scripts

## enrich_and_build.py

Enrich `data/products.json` from `raw/` replies + live product/GitHub pages, download covers into `public/images/products/`, and rebuild:

- `public/data/products.json`
- index (cards + 点赞榜 / 浏览榜 tabs)
- static detail pages at `public/p/{slug}/index.html`

```bash
python3 scripts/enrich_and_build.py
```

## Frontend (React + Vite)

```bash
npm install
npm run build   # → dist/
```

## Deploy (Workers assets — verified)

```bash
set -a; source /home/box/.cf_aitv.env; set +a
# wrangler.toml: [assets] directory = "./dist"; NO pages_build_output_dir
npx wrangler deploy --name aicodinghunt
```

Custom domain `aicodinghunt.qiaomu.ai` is already attached.

