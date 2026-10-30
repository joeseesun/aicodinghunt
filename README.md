# AI Coding Hunt · 乔木 AI 工具猎场

把 [@vista8](https://x.com/vista8) 社区自荐帖里的 AI 工具、Agent、插件与开源项目，整理成可检索、可排序的图文目录。

**线上：** [https://aicodinghunt.qiaomu.ai](https://aicodinghunt.qiaomu.ai)

## 技术栈

- React + Vite + Tailwind CSS v4
- 数据：`data/products.json` → 构建时复制到 `public/data/`
- 推荐人 X 真头像：`public/images/avatars/`
- 部署：Cloudflare Workers Assets（`wrangler.toml` → `[assets] directory = "./dist"`）

## 本地开发

```bash
npm install
npm run dev
```

```bash
npm run build    # Vite + 详情 SEO HTML → dist/
npm run preview
```

## 部署

```bash
npm run build
set -a; source /home/box/.cf_aitv.env; set +a
npx wrangler deploy --name aicodinghunt
```

自定义域名 `aicodinghunt.qiaomu.ai` 已绑定。

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

视觉语言见 `design-tokens.md`（Yarrow 卡片栅格 / 色板 / 圆角 / 阴影）。品牌文案为「AI Coding Hunt / 乔木 AI 工具猎场」。

## License

MIT
