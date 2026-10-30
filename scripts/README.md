# Scripts

`build_worker_upload.py` — builds an embedded Worker multipart payload under `/tmp` for emergency API upload when Pages permissions are missing.

Prefer:

```bash
source /home/box/.cf_aitv.env   # or export a Pages-capable CLOUDFLARE_API_TOKEN
npx wrangler pages deploy public --project-name aicodinghunt --commit-dirty=true
```

Then bind custom domain `aicodinghunt.qiaomu.ai` in the Pages project (or DNS CNAME to `aicodinghunt.pages.dev`, proxied).
