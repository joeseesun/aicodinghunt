# AI Coding Hunt · 乔木 AI 工具猎场

**中文** | [English](#english)

> 把 [@vista8](https://x.com/vista8) 社区自荐帖里的 AI 工具与项目，整理成可搜索、可筛选的静态猎场。
>
> A searchable catalog of AI tools and projects recommended in [@vista8](https://x.com/vista8)'s community self-nomination thread.

**在线体验:** https://aicodinghunt.qiaomu.ai  
**源帖:** https://x.com/vista8/status/2115318655525523714  
**License:** MIT

**已验证:** 静态站可本地 `python3 -m http.server` 打开；产品数据见 `data/products.json`（当前 **78** 个产品）。

## 这是什么

一次 X 帖子征集「最喜欢用的 AI 工具和项目」之后，评论区堆满了自建站、订阅工具、Skill、插件和开源仓库。这份仓库把回复抓全、去闲聊、去重，做成一张中文优先的目录站。

## 为什么值得用

| 能力 | 你得到什么 |
|---|---|
| 分类筛选 | Coding Agent / CLI / 桌面 / 插件·Skill / 记忆 / 教育 / 其他 |
| 搜索 | 按名称、描述、推荐人 `@handle` 过滤 |
| 溯源 | 每张卡片回到推荐人与原回复 |
| 开源可改 | 纯静态 HTML/CSS/JS，改 `data/products.json` 即可 |

## 数据概览

- 产品数：**78**
- 抓取回复：**161**（含嵌套回复）
- 源帖宣称回复数：115
- 分类：education 4, desktop 11, plugin 11, other 30, coding agent 16, cli 4, memory 2
- 更新：2026-10-30 08:12 Asia/Shanghai

## 快速开始

### 最快路径

```bash
git clone https://github.com/joeseesun/aicodinghunt.git
cd aicodinghunt
python3 -m http.server 8787 --directory public
# 打开 http://127.0.0.1:8787
```

<details>
<summary>用 Cloudflare Pages 部署</summary>

```bash
export CLOUDFLARE_API_TOKEN=...   # 勿提交到仓库
npx wrangler pages deploy public --project-name aicodinghunt --branch main
# 自定义域名：aicodinghunt.qiaomu.ai
```

</details>

## 项目结构

```text
aicodinghunt/
  public/           # 静态站点（部署目录）
  data/products.json
  data/products.md
  raw/              # X API 原始分页（可选，开发用）
  wrangler.toml
```

## 限制与边界

- 目录来自社区自荐，**不是**官方测评或排行榜。
- 部分链接可能仍是 `t.co` 短链或原帖截图链接。
- `raw/` 含公开帖文快照；发布时默认一并开源。不含任何 API token。

## 关于向阳乔木

- 网站：https://www.qiaomu.ai/
- 博客：https://blog.qiaomu.ai/
- X：https://x.com/vista8
- GitHub：https://github.com/joeseesun/
- 公众号：向阳乔木推荐看

---

<a name="english"></a>
# English

**AI Coding Hunt** turns the replies under [@vista8](https://x.com/vista8)'s self-nomination post into a searchable static catalog of AI coding tools, agents, plugins, skills, and open-source projects.

## Try it

- Live: https://aicodinghunt.qiaomu.ai
- Source post: https://x.com/vista8/status/2115318655525523714

```bash
git clone https://github.com/joeseesun/aicodinghunt.git
cd aicodinghunt
python3 -m http.server 8787 --directory public
```

## Verified

- Product catalog: `data/products.json` (78 products)
- Categories: education 4, desktop 11, plugin 11, other 30, coding agent 16, cli 4, memory 2
- Last updated: 2026-10-30 08:12 Asia/Shanghai

## Limits

Community nominations only — not endorsements. Some URLs may remain short links. No secrets are stored in this repo.

## License

MIT © 向阳乔木
