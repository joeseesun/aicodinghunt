# 投稿收件箱（submissions）

网站 `/submit` 提交的产品会：

1. 由 Cloudflare Worker 抓取产品页 OG/标题
2. 创建 GitHub Issue（label: `submission`）
3. 可选图片存入 R2 `aicodinghunt-submissions`，并通过 `/api/submission-assets/...` 访问

审核通过后，用：

```bash
node scripts/promote-submission.mjs --issue <number>
# 或
node scripts/promote-submission.mjs --file submissions/inbox/<id>.json
```

写入 `data/products.json`（需人工核对后 `npm run build` + 部署）。
