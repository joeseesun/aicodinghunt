# AI Coding Hunt · 乔木 AI 工具猎场

把 [@vista8](https://x.com/vista8) 社区自荐帖里的 AI 工具、Agent、插件与开源项目，整理成可检索、可排序的图文目录。

**线上：** [https://aicodinghunt.qiaomu.ai](https://aicodinghunt.qiaomu.ai)

## 技术栈

- React + Vite + Tailwind CSS v4
- 数据：`data/products.json` → 构建时复制到 `public/data/`
- 推荐人 X 真头像：`public/images/avatars/`
- 部署：Cloudflare Workers Assets（`wrangler.toml` → `[assets] directory = "./dist"`）
- 本站指标：Worker + KV（`METRICS`）

## 本站指标（与 X 分开）

| 指标 | 含义 | 去重策略 |
|------|------|----------|
| **本站点赞** `site_upvotes` | 猎场内点赞 | **每个访客对每个产品终身一票**（可取消/toggle）。不采用 24h 冷却，更接近 Product Hunt「一票定生死」的排序语义。 |
| **本站浏览** `site_views` | 详情页曝光 | **每个访客对每个产品每个 UTC 日计一次**。 |

访客键优先使用浏览器 `localStorage` UUID（请求头 `X-ACH-Visitor`），避免 NAT / 移动网络换 IP 导致重复计；若无 UUID 则回退 `SHA-256(IP + "|" + slug)`。原始 IP **不**写入公开 JSON。聚合计数存 Durable Object，并镜像到 KV。

- X 的 `like_count` / `impression_count` 仍显示为「社区点赞 / 社区浏览」。

### API

```
POST /api/view     { "slug": "..." }
POST /api/upvote   { "slug": "...", "action": "toggle"|"up"|"down" }
GET  /api/metrics?slugs=a,b,c
GET  /api/metrics/:slug
```

响应字段：`site_views`、`site_upvotes`、`voted`（当前 IP 是否已点赞）。

## 本地开发

```bash
npm install
npm run dev
```

```bash
npm run build    # Vite + 详情 SEO HTML → dist/
npm run preview
```

本地 `vite` 无 Worker 时，指标 API 会静默失败，UI 仍可用。

## 部署

```bash
npm run build
set -a; source /home/box/.cf_aitv.env; set +a
npx wrangler deploy --name aicodinghunt
```

自定义域名 `aicodinghunt.qiaomu.ai` 已绑定。KV：`aicodinghunt-metrics`。

## 投稿

线上入口：[https://aicodinghunt.qiaomu.ai/submit](https://aicodinghunt.qiaomu.ai/submit)

- 用户提交链接 + 中文描述（可上传图片）
- Worker `POST /api/submit` 抓取 OG，写入 R2，并创建 GitHub Issue（label: `submission`）
- 审核通过：`node scripts/promote-submission.mjs --issue <n>`

## 数据更新

见 `scripts/README.md`：

- `python3 scripts/fetch_avatars.py` — X 真头像
- `python3 scripts/enrich_and_build.py` — 封面 / 字段 enrich
- `python3 scripts/ingest_conversation.py --check` — 会话增量收录检查（conversation `2115318655525523714`）

## 设计

视觉语言见 `design-tokens.md`（Yarrow 卡片栅格 / 色板 / 圆角 / 阴影）。品牌文案为「AI Coding Hunt / 乔木 AI 工具猎场」。列表/详情对标 Product Hunt：清晰 upvote、Try it 主 CTA、Maker 推荐人、讨论/原帖链接。

## License

MIT
