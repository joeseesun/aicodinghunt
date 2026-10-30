#!/usr/bin/env python3
"""Enrich products with detail/images and rebuild static site with detail pages + rankings."""
from __future__ import annotations

import hashlib
import html
import json
import os
import re
import subprocess
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path("/workspace/aicodinghunt")
RAW = ROOT / "raw"
DATA = ROOT / "data"
PUBLIC = ROOT / "public"
IMG_DIR = PUBLIC / "images" / "products"
TZ = timezone(timedelta(hours=8))

UA = "Mozilla/5.0 (compatible; AICodingHuntBot/1.0; +https://aicodinghunt.qiaomu.ai)"
TIMEOUT = 14
WECHAT_HOSTS = {"mp.weixin.qq.com", "weixin.qq.com"}

CAT_LABELS = {
    "coding agent": "Coding Agent",
    "cli": "CLI",
    "desktop": "桌面应用",
    "plugin": "插件 / Skill",
    "memory": "记忆",
    "education": "教育",
    "other": "其他",
}
CAT_ORDER = ["coding agent", "cli", "desktop", "plugin", "memory", "education", "other"]
CAT_COLORS = {
    "coding agent": "#b45309",
    "cli": "#0f766e",
    "desktop": "#1d4ed8",
    "plugin": "#7c3aed",
    "memory": "#be185d",
    "education": "#047857",
    "other": "#57534e",
}


def now_label():
    dt = datetime.now(TZ)
    return dt.isoformat(), dt.strftime("%Y-%m-%d %H:%M Asia/Shanghai")


def slugify(name: str, fallback: str) -> str:
    s = unicodedata.normalize("NFKC", name or "").strip().lower()
    s = re.sub(r"[^\w\u4e00-\u9fff]+", "-", s, flags=re.UNICODE)
    s = re.sub(r"-+", "-", s).strip("-")
    if not s:
        s = fallback
    # keep readable but filesystem-safe; limit length
    if len(s) > 60:
        s = s[:60].rstrip("-")
    return s


def clean_url(u: str | None) -> str | None:
    if not u:
        return None
    u = u.strip()
    m = re.match(r"(https?://t\.co/[A-Za-z0-9]+)", u)
    if m:
        return m.group(1)
    # strip trailing CJK glued to URL
    m = re.match(r"(https?://\S+?)(?=[\u4e00-\u9fff]|$)", u)
    if m:
        return m.group(1).rstrip(")。,，.;；")
    if u.startswith("http"):
        return u
    return None


def is_wechat(url: str | None) -> bool:
    if not url:
        return False
    try:
        return urlparse(url).netloc.lower().endswith("weixin.qq.com") or "mp.weixin.qq.com" in url
    except Exception:
        return False


def is_x_status(url: str | None) -> bool:
    if not url:
        return False
    return bool(re.search(r"(?:x\.com|twitter\.com)/[^/]+/status/\d+", url or ""))


def curl_get(url: str, dest: Path | None = None, binary=False, max_time=TIMEOUT):
    cmd = [
        "curl", "-sL", "--max-time", str(max_time), "--max-redirs", "8",
        "-A", UA, "-H", "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8",
    ]
    if dest:
        cmd += ["-o", str(dest), "-w", "%{http_code}|%{content_type}|%{url_effective}"]
    else:
        cmd += ["-w", "\n__META__%{http_code}|%{content_type}|%{url_effective}"]
    cmd.append(url)
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=max_time + 8)
        out = r.stdout
        if dest:
            meta = out.decode("utf-8", "replace").strip()
            parts = meta.split("|")
            code = int(parts[0]) if parts and parts[0].isdigit() else 0
            ctype = parts[1] if len(parts) > 1 else ""
            final = parts[2] if len(parts) > 2 else url
            return code, ctype, final, dest if dest.exists() and dest.stat().st_size > 0 else None
        text = out.decode("utf-8", "replace")
        if "__META__" in text:
            body, meta = text.rsplit("__META__", 1)
            parts = meta.strip().split("|")
            code = int(parts[0]) if parts and parts[0].isdigit() else 0
            ctype = parts[1] if len(parts) > 1 else ""
            final = parts[2] if len(parts) > 2 else url
            return code, ctype, final, body
        return 0, "", url, text
    except Exception as e:
        return 0, "", url, None


def extract_meta(html_text: str) -> dict:
    if not html_text:
        return {}
    out = {}
    # og / twitter meta
    for prop, key in [
        ("og:title", "title"),
        ("og:description", "description"),
        ("og:image", "image"),
        ("twitter:image", "image"),
        ("twitter:title", "title"),
        ("twitter:description", "description"),
        ("description", "description"),
    ]:
        if key in out and out[key]:
            continue
        patterns = [
            rf'<meta[^>]+(?:property|name)=["\']{re.escape(prop)}["\'][^>]+content=["\']([^"\']+)["\']',
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(prop)}["\']',
        ]
        for pat in patterns:
            m = re.search(pat, html_text, re.I)
            if m:
                out[key] = html.unescape(m.group(1).strip())
                break
    # <title>
    if "title" not in out:
        m = re.search(r"<title[^>]*>([^<]+)</title>", html_text, re.I)
        if m:
            out["title"] = html.unescape(m.group(1).strip())
    # github stars from page
    m = re.search(r'id="repo-stars-counter-star"[^>]*>([^<]+)<', html_text)
    if m:
        out["stars_text"] = m.group(1).strip()
    m = re.search(r'aria-label="(\d[\d,]*) users starred this repository"', html_text)
    if m:
        out["stars"] = int(m.group(1).replace(",", ""))
    # chrome web store users
    m = re.search(r'([\d,]+)\s*(?:users|用户)', html_text, re.I)
    if m and "chromewebstore" in html_text.lower():
        out["downloads_text"] = m.group(1)
    # pricing hints
    low = html_text.lower()
    if re.search(r"\bfree\b|免费|开源|mit license|apache-2", low):
        out["pricing_hint"] = "免费 / 开源倾向"
    if re.search(r"pricing|订阅|¥|\$\d|定价", low):
        if "pricing_hint" not in out:
            out["pricing_hint"] = "含付费选项（见官网）"
    return out


def github_api_meta(repo_url: str) -> dict:
    m = re.match(r"https?://github\.com/([^/]+)/([^/#?]+)", repo_url)
    if not m:
        return {}
    owner, repo = m.group(1), m.group(2).removesuffix(".git")
    api = f"https://api.github.com/repos/{owner}/{repo}"
    code, _, _, body = curl_get(api, max_time=10)
    if code != 200 or not body:
        return {}
    try:
        data = json.loads(body)
    except Exception:
        return {}
    out = {
        "stars": data.get("stargazers_count"),
        "description": data.get("description") or "",
        "image": f"https://opengraph.githubassets.com/1/{owner}/{repo}",
        "homepage": data.get("homepage") or "",
        "language": data.get("language") or "",
        "topics": data.get("topics") or [],
    }
    return out


def ext_from_ctype_url(ctype: str, url: str) -> str:
    ctype = (ctype or "").split(";")[0].strip().lower()
    map_ = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/svg+xml": ".svg",
        "image/x-icon": ".ico",
        "image/vnd.microsoft.icon": ".ico",
    }
    if ctype in map_:
        return map_[ctype]
    path = urlparse(url).path.lower()
    for e in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".ico"):
        if path.endswith(e):
            return ".jpg" if e == ".jpeg" else e
    return ".jpg"


def make_placeholder_svg(name: str, category: str, dest: Path) -> str:
    color = CAT_COLORS.get(category, "#57534e")
    initial = (name or "?").strip()[:1] or "?"
    label = html.escape(name[:18])
    cat = html.escape(CAT_LABELS.get(category, category))
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{color}" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#1a1a1a" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#f7f5f0"/>
  <rect x="0" y="0" width="1200" height="630" fill="url(#g)"/>
  <circle cx="220" cy="315" r="110" fill="rgba(255,255,255,0.16)"/>
  <text x="220" y="350" text-anchor="middle" font-family="Georgia, serif" font-size="96" fill="#fff">{html.escape(initial)}</text>
  <text x="400" y="290" font-family="Georgia, 'Noto Serif SC', serif" font-size="48" fill="#fff">{label}</text>
  <text x="400" y="350" font-family="system-ui, sans-serif" font-size="28" fill="rgba(255,255,255,0.85)">{cat} · AI Coding Hunt</text>
  <text x="400" y="400" font-family="system-ui, sans-serif" font-size="22" fill="rgba(255,255,255,0.65)">图片暂缺 · 占位封面</text>
</svg>'''
    dest.write_text(svg, encoding="utf-8")
    return f"/images/products/{dest.name}"


def download_image(url: str, slug: str, idx: int = 0) -> str | None:
    if not url or is_wechat(url):
        return None
    # skip data urls oversized
    if url.startswith("data:"):
        return None
    # absolutize protocol-relative
    if url.startswith("//"):
        url = "https:" + url
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    tmp = IMG_DIR / f".tmp-{slug}-{idx}"
    code, ctype, final, path = curl_get(url, dest=tmp, binary=True, max_time=12)
    if not path or code >= 400 or code == 0:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        return None
    # reject tiny / non-image
    size = path.stat().st_size
    if size < 200:
        path.unlink(missing_ok=True)
        return None
    if ctype and not ctype.startswith("image/") and "octet-stream" not in ctype and "svg" not in ctype:
        # still allow if extension looks like image
        if not any(final.lower().endswith(e) for e in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg")):
            path.unlink(missing_ok=True)
            return None
    ext = ext_from_ctype_url(ctype, final)
    name = f"{slug}{'' if idx == 0 else f'-{idx}'}{ext}"
    dest = IMG_DIR / name
    if dest.exists():
        dest.unlink()
    path.rename(dest)
    return f"/images/products/{name}"


def load_sources():
    catalog = json.loads((DATA / "products.json").read_text(encoding="utf-8"))
    expansions = json.loads((RAW / "entity_expansions.json").read_text(encoding="utf-8"))
    cands = json.loads((RAW / "candidates.json").read_text(encoding="utf-8"))
    all_posts = json.loads((RAW / "all_posts.json").read_text(encoding="utf-8"))
    posts_by_id = {p["id"]: p for p in all_posts.get("posts") or []}
    for t in all_posts.get("includes_tweets") or []:
        posts_by_id.setdefault(t["id"], t)
    users = {u["id"]: u for u in (all_posts.get("users") or [])} if isinstance(all_posts.get("users"), list) else {}

    # rebuild expansions from pages + posts
    for page in sorted(RAW.glob("page_*.json")):
        try:
            data = json.loads(page.read_text(encoding="utf-8"))
        except Exception:
            continue

        def walk(o):
            if isinstance(o, dict):
                if str(o.get("url", "")).startswith("https://t.co") and o.get("expanded_url"):
                    expansions[o["url"]] = o["expanded_url"]
                for v in o.values():
                    walk(v)
            elif isinstance(o, list):
                for i in o:
                    walk(i)

        walk(data)

    for p in posts_by_id.values():
        for u in (p.get("entities") or {}).get("urls") or []:
            if str(u.get("url", "")).startswith("https://t.co") and u.get("expanded_url"):
                expansions[u["url"]] = u["expanded_url"]

    # url -> card image
    url_images = {}
    reply_images = {}
    for p in posts_by_id.values():
        for u in (p.get("entities") or {}).get("urls") or []:
            imgs = u.get("images") or []
            if not imgs:
                continue
            img_url = imgs[0].get("url")
            if not img_url:
                continue
            reply_images.setdefault(p["id"], []).append(img_url)
            for key in filter(None, [u.get("expanded_url"), u.get("unwound_url"), u.get("url")]):
                url_images[key] = img_url

    cand_by_reply = {c["reply_url"]: c for c in cands if c.get("reply_url")}
    return catalog, expansions, posts_by_id, cand_by_reply, url_images, reply_images


def expand(url: str | None, expansions: dict) -> str | None:
    if not url:
        return None
    url = clean_url(url) or url
    return expansions.get(url, url)


def status_id_from_url(url: str) -> str | None:
    m = re.search(r"/status/(\d+)", url or "")
    return m.group(1) if m else None


def strip_handles(text: str) -> str:
    t = re.sub(r"^(@\w+\s*)+", "", text or "").strip()
    t = re.sub(r"https?://t\.co/\w+", "", t)
    t = re.sub(r"\n{3,}", "\n\n", t).strip()
    return t


def enrich_one(product, expansions, posts_by_id, cand_by_reply, url_images, reply_images, used_slugs):
    name = product["name"]
    base_slug = slugify(name, product["id"])
    slug = base_slug
    n = 2
    while slug in used_slugs:
        slug = f"{base_slug}-{n}"
        n += 1
    used_slugs.add(slug)

    replies = product.get("replies") or []
    reply_texts = []
    source_reply_urls = []
    like_count = int(product.get("likes") or 0)
    bookmark_count = int(product.get("bookmarks") or 0)
    impression_count = 0
    card_imgs = []
    repo_url = None
    homepage = None

    raw_url = clean_url(product.get("url"))
    expanded_url = expand(raw_url, expansions)
    if expanded_url and is_wechat(expanded_url):
        # keep but don't fetch
        pass

    for r in replies:
        rurl = r.get("url")
        if rurl:
            source_reply_urls.append(rurl)
        sid = status_id_from_url(rurl or "")
        cand = cand_by_reply.get(rurl) if rurl else None
        if cand and cand.get("text"):
            reply_texts.append(strip_handles(cand["text"]))
            for u in cand.get("all_urls") or cand.get("urls") or []:
                eu = expand(clean_url(u), expansions) or clean_url(u)
                if eu and "github.com" in eu and not repo_url:
                    repo_url = eu.split("?")[0]
                if eu and not homepage and not is_x_status(eu) and not is_wechat(eu) and "t.co" not in (eu or ""):
                    if "github.com" not in eu:
                        homepage = eu
        post = posts_by_id.get(sid) if sid else None
        if post:
            pm = post.get("public_metrics") or {}
            impression_count = max(impression_count, int(pm.get("impression_count") or 0))
            like_count = max(like_count, int(pm.get("like_count") or 0) or like_count)
            bookmark_count = max(bookmark_count, int(pm.get("bookmark_count") or 0) or bookmark_count)
            txt = strip_handles(post.get("text") or "")
            if txt and txt not in reply_texts:
                reply_texts.append(txt)
            for iu in reply_images.get(sid, []):
                card_imgs.append(iu)
            for u in (post.get("entities") or {}).get("urls") or []:
                eu = u.get("expanded_url") or u.get("unwound_url")
                if eu and "github.com" in eu and not repo_url:
                    repo_url = eu.split("?")[0]

    # prefer non-x homepage
    url = homepage or expanded_url or raw_url
    if url and is_x_status(url) and repo_url:
        url = repo_url
    if url and "github.com" in (url or "") and not repo_url:
        repo_url = url.split("?")[0]

    if expanded_url and expanded_url in url_images:
        card_imgs.append(url_images[expanded_url])
    if raw_url and raw_url in url_images:
        card_imgs.append(url_images[raw_url])

    # Fetch page meta
    meta = {}
    gh = {}
    fetch_target = None
    if repo_url:
        gh = github_api_meta(repo_url)
        if gh:
            meta.update({k: v for k, v in gh.items() if v})
    if url and not is_wechat(url) and not is_x_status(url):
        fetch_target = url
    elif repo_url:
        fetch_target = repo_url

    page_meta = {}
    if fetch_target and not is_wechat(fetch_target):
        code, ctype, final, body = curl_get(fetch_target, max_time=TIMEOUT)
        if code and code < 400 and body and isinstance(body, str) and len(body) > 200:
            page_meta = extract_meta(body)
            # resolve relative og image
            if page_meta.get("image") and page_meta["image"].startswith("/"):
                page_meta["image"] = urljoin(final, page_meta["image"])
            if final and final.startswith("http") and not is_x_status(final) and "t.co" not in final:
                # update url if redirect landed on better page
                if not url or is_x_status(url) or "t.co" in url:
                    url = final

    # Compose detail
    summary = product.get("description") or ""
    detail_parts = []
    if reply_texts:
        # longest unique reply as community pitch
        best = max(reply_texts, key=len)
        if best:
            detail_parts.append(best)
    desc_page = page_meta.get("description") or meta.get("description") or ""
    if desc_page and desc_page not in "".join(detail_parts):
        # translate-ish: keep as supplementary if Chinese summary short
        if len(summary) < 40 or desc_page not in summary:
            detail_parts.append(desc_page)
    if not detail_parts:
        detail_parts.append(summary or f"{name} — 来自社区自荐。")

    detail = "\n\n".join(detail_parts).strip()
    if len(summary) < 8 and desc_page:
        summary = desc_page[:120]

    tags = []
    tags.append(CAT_LABELS.get(product["category"], product["category"]))
    for t in (meta.get("topics") or [])[:5]:
        tags.append(t)
    if meta.get("language"):
        tags.append(meta["language"])
    pricing = page_meta.get("pricing_hint") or ("开源" if repo_url else None)

    stars = meta.get("stars")
    if not stars and page_meta.get("stars"):
        stars = page_meta["stars"]

    # Image candidates
    img_candidates = []
    for c in card_imgs:
        if c and c not in img_candidates:
            img_candidates.append(c)
    for key in ("image",):
        if page_meta.get(key):
            img_candidates.append(page_meta[key])
        if meta.get(key):
            img_candidates.append(meta[key])
    # github opengraph fallback
    if repo_url and re.match(r"https?://github\.com/[^/]+/[^/]+", repo_url):
        m = re.match(r"https?://github\.com/([^/]+)/([^/#?]+)", repo_url)
        if m:
            img_candidates.append(f"https://opengraph.githubassets.com/1/{m.group(1)}/{m.group(2).removesuffix('.git')}")
    # favicon as last resort
    if url and not is_x_status(url) and not is_wechat(url):
        try:
            host = urlparse(url).scheme + "://" + urlparse(url).netloc
            img_candidates.append(host + "/apple-touch-icon.png")
            img_candidates.append(host + "/favicon.ico")
        except Exception:
            pass

    local_image = None
    gallery = []
    image_note = None
    for i, cand in enumerate(img_candidates[:5]):
        if is_wechat(cand):
            continue
        got = download_image(cand, slug, i)
        if got:
            if not local_image:
                local_image = got
            elif got not in gallery:
                gallery.append(got)
            if i >= 1 and local_image:
                break  # one hero + maybe one gallery enough for speed
    if not local_image:
        ph = IMG_DIR / f"{slug}.svg"
        local_image = make_placeholder_svg(name, product["category"], ph)
        image_note = "未能抓取到官网/仓库封面，已使用占位图。"

    iso, label = now_label()
    enriched = {
        "id": product["id"],
        "name": name,
        "slug": slug,
        "summary": summary,
        "detail": detail,
        "category": product["category"],
        "url": url if url and not (is_x_status(url) and source_reply_urls) else (url or None),
        "repo_url": repo_url,
        "recommenders": product.get("recommenders") or [],
        "source_reply_urls": source_reply_urls,
        "replies": replies,
        "image": local_image,
        "gallery": gallery or None,
        "image_note": image_note,
        "tags": tags,
        "pricing": pricing,
        "stars": stars,
        "likes": like_count,
        "bookmarks": bookmark_count,
        "impressions": impression_count or None,
        "like_count": like_count,
        "impression_count": impression_count or None,
        "updated": label,
    }
    # Prefer official site over x status for url field display
    if enriched["url"] and is_x_status(enriched["url"]):
        if repo_url:
            enriched["url"] = repo_url
        else:
            enriched["url"] = None
    return enriched


def escape(s):
    return html.escape(str(s or ""), quote=True)


def related_products(p, all_products, n=4):
    same = [x for x in all_products if x["category"] == p["category"] and x["slug"] != p["slug"]]
    same.sort(key=lambda x: (-(x.get("like_count") or 0), -(x.get("impression_count") or 0)))
    return same[:n]


def render_detail_page(p, catalog, all_products):
    cat = CAT_LABELS.get(p["category"], p["category"])
    recs = "、".join(f"@{h}" for h in (p.get("recommenders") or [])) or "社区推荐"
    links = []
    if p.get("url"):
        links.append(f'<a class="btn primary" href="{escape(p["url"])}" target="_blank" rel="noopener">官网</a>')
    if p.get("repo_url") and p.get("repo_url") != p.get("url"):
        links.append(f'<a class="btn" href="{escape(p["repo_url"])}" target="_blank" rel="noopener">GitHub</a>')
    for i, u in enumerate(p.get("source_reply_urls") or []):
        label = "原帖" if i == 0 else f"原帖 {i+1}"
        links.append(f'<a class="btn ghost" href="{escape(u)}" target="_blank" rel="noopener">{label}</a>')
    stats = []
    if p.get("like_count"):
        stats.append(f"♥ {p['like_count']} 赞")
    if p.get("impression_count"):
        stats.append(f"👁 {p['impression_count']:,} 浏览")
    if p.get("stars"):
        stats.append(f"★ {p['stars']:,} stars")
    if p.get("bookmarks"):
        stats.append(f"🔖 {p['bookmarks']}")
    if p.get("pricing"):
        stats.append(escape(p["pricing"]))
    tags = "".join(f'<span class="tag">{escape(t)}</span>' for t in (p.get("tags") or [])[:8])
    detail_html = "<p>" + escape(p.get("detail") or p.get("summary") or "").replace("\n\n", "</p><p>").replace("\n", "<br>") + "</p>"
    note = f'<p class="image-note">{escape(p["image_note"])}</p>' if p.get("image_note") else ""
    related = related_products(p, all_products)
    related_html = ""
    if related:
        cards = []
        for r in related:
            cards.append(
                f'''<a class="related-card" href="/p/{escape(r["slug"])}/">
                <img src="{escape(r.get("image") or "")}" alt="" loading="lazy" />
                <div><strong>{escape(r["name"])}</strong><span>{escape(r.get("summary") or "")}</span></div>
                </a>'''
            )
        related_html = '<section class="related"><h2>相关产品</h2><div class="related-grid">' + "".join(cards) + "</div></section>"

    gallery = ""
    if p.get("gallery"):
        imgs = "".join(f'<img src="{escape(g)}" alt="" loading="lazy" />' for g in p["gallery"][:3])
        gallery = f'<div class="gallery">{imgs}</div>'

    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="description" content="{escape(p.get("summary") or p["name"])}" />
  <meta property="og:title" content="{escape(p["name"])} · AI Coding Hunt" />
  <meta property="og:description" content="{escape(p.get("summary") or "")}" />
  <meta property="og:image" content="{escape(p.get("image") or "")}" />
  <meta property="og:type" content="article" />
  <title>{escape(p["name"])} · 乔木 AI 工具猎场</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;700&family=Noto+Sans+SC:wght@400;500;600&display=swap" rel="stylesheet" />
  <script>
    try {{
      const t = localStorage.getItem('theme');
      if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
    }} catch {{}}
  </script>
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
  <div class="page detail-page">
    <header class="topbar">
      <a class="brand" href="/">向阳乔木 · AI Coding Hunt</a>
      <nav class="nav">
        <a href="/">← 猎场首页</a>
        <a href="https://github.com/joeseesun/aicodinghunt" target="_blank" rel="noopener">GitHub</a>
        <button type="button" class="theme-toggle" id="themeToggle" aria-label="切换深浅色">◐</button>
      </nav>
    </header>
    <main>
      <p class="crumb"><a href="/">猎场</a> / <span>{escape(cat)}</span> / <span>{escape(p["name"])}</span></p>
      <article class="detail">
        <div class="hero-media">
          <img src="{escape(p.get("image") or "")}" alt="{escape(p["name"])}" />
          {note}
        </div>
        <div class="detail-body">
          <div class="detail-top">
            <span class="cat">{escape(cat)}</span>
            <span class="stats">{" · ".join(stats)}</span>
          </div>
          <h1>{escape(p["name"])}</h1>
          <p class="summary">{escape(p.get("summary") or "")}</p>
          <div class="tags">{tags}</div>
          <div class="actions">{" ".join(links)}</div>
          <section class="writeup">
            <h2>详情</h2>
            {detail_html}
          </section>
          <p class="recs-line">推荐人：{escape(recs)}</p>
          <p class="meta">更新 {escape(p.get("updated") or catalog.get("updated_at_label") or "")}</p>
          {gallery}
        </div>
      </article>
      {related_html}
    </main>
    <footer class="footer">
      <p>向阳乔木 · <a href="https://www.qiaomu.ai/">qiaomu.ai</a> · <a href="https://x.com/vista8">@vista8</a></p>
      <p class="small">开源 MIT · 内容来自社区自荐，非官方测评</p>
    </footer>
  </div>
  <script>
    document.getElementById('themeToggle')?.addEventListener('click', () => {{
      const cur = document.documentElement.dataset.theme;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const nowDark = cur ? cur === 'dark' : prefersDark;
      const next = nowDark ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {{ localStorage.setItem('theme', next); }} catch {{}}
    }});
  </script>
</body>
</html>
'''


def write_site_files(catalog):
    products = catalog["products"]
    # detail pages
    for p in products:
        d = PUBLIC / "p" / p["slug"]
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(render_detail_page(p, catalog, products), encoding="utf-8")

    # CSS append detail + ranking styles (rewrite full css)
    css = (PUBLIC / "css" / "style.css").read_text(encoding="utf-8")
    # We'll rewrite style.css completely for clarity
    (PUBLIC / "css" / "style.css").write_text(SITE_CSS, encoding="utf-8")
    (PUBLIC / "js" / "app.js").write_text(SITE_JS, encoding="utf-8")
    (PUBLIC / "index.html").write_text(SITE_INDEX, encoding="utf-8")

    # data
    (PUBLIC / "data").mkdir(exist_ok=True)
    (PUBLIC / "data" / "products.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (DATA / "products.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


SITE_INDEX = r'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)" />
  <meta name="description" content="乔木 AI 工具猎场 — 来自 @vista8 社区自荐帖的 AI Coding 工具与产品目录" />
  <meta property="og:title" content="AI Coding Hunt · 乔木 AI 工具猎场" />
  <meta property="og:description" content="把 X 上自荐的 AI 工具、Agent、插件与开源项目整理成可检索的猎场。" />
  <meta property="og:url" content="https://aicodinghunt.qiaomu.ai/" />
  <meta property="og:type" content="website" />
  <title>AI Coding Hunt · 乔木 AI 工具猎场</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;700&family=Noto+Sans+SC:wght@400;500;600&display=swap" rel="stylesheet" />
  <script>
    try {
      const t = localStorage.getItem('theme');
      if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
    } catch {}
    document.documentElement.classList.add('js');
  </script>
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
  <div class="page">
    <header class="topbar">
      <a class="brand" href="/">向阳乔木 · AI Coding Hunt</a>
      <nav class="nav">
        <a href="https://x.com/vista8/status/2115318655525523714" target="_blank" rel="noopener">源帖</a>
        <a href="https://github.com/joeseesun/aicodinghunt" target="_blank" rel="noopener">GitHub</a>
        <a href="https://www.qiaomu.ai/" target="_blank" rel="noopener">qiaomu.ai</a>
        <button type="button" class="theme-toggle" id="themeToggle" aria-label="切换深浅色">◐</button>
      </nav>
    </header>

    <main>
      <section class="hero">
        <p class="eyebrow">社区自荐 · 工具猎场</p>
        <h1>乔木 <em>AI 工具猎场</em></h1>
        <p class="lede">
          来自 <a href="https://x.com/vista8" target="_blank" rel="noopener">@vista8</a> 的自荐帖：
          把评论区里大家真正在用、在做的 AI 工具与项目，整理成一张可检索、可排序的图文目录。
          每个产品都有详情页；榜单按原帖点赞与浏览量排列。
        </p>
        <div class="proof" id="proofStrip">加载中…</div>
      </section>

      <section class="controls" aria-label="筛选">
        <div class="view-tabs" id="viewTabs" role="tablist">
          <button type="button" class="tab active" data-view="cards" role="tab" aria-selected="true">全部卡片</button>
          <button type="button" class="tab" data-view="likes" role="tab" aria-selected="false">点赞榜</button>
          <button type="button" class="tab" data-view="impressions" role="tab" aria-selected="false">浏览榜</button>
        </div>
        <div class="search-wrap">
          <input id="search" type="search" placeholder="搜索名称、描述、推荐人…" autocomplete="off" />
        </div>
        <div class="filters" id="filters"></div>
      </section>

      <section class="grid" id="grid" aria-live="polite"></section>
      <section class="rank-list hidden" id="rankList" aria-live="polite"></section>

      <section class="note">
        <h2>关于这份目录</h2>
        <p>
          数据来自
          <a href="https://x.com/vista8/status/2115318655525523714" target="_blank" rel="noopener">X 自荐帖</a>
          的全部回复。纯闲聊已剔除；同一产品多条推荐会合并推荐人。
          点赞榜 / 浏览榜取自原帖回复的 public_metrics（like_count、impression_count）；缺失标为「—」并排后。
          每个产品可进详情页，也可回原帖。
        </p>
        <p class="meta" id="updatedMeta"></p>
      </section>
    </main>

    <footer class="footer">
      <p>向阳乔木 · <a href="https://www.qiaomu.ai/">qiaomu.ai</a> · <a href="https://x.com/vista8">@vista8</a> · <a href="https://github.com/joeseesun">GitHub</a></p>
      <p class="small">开源 MIT · 内容来自社区自荐，非官方测评</p>
    </footer>
  </div>
  <script src="/js/app.js"></script>
</body>
</html>
'''

SITE_JS = r'''const CAT_LABELS = {
  'coding agent': 'Coding Agent',
  'cli': 'CLI',
  'desktop': '桌面应用',
  'plugin': '插件 / Skill',
  'memory': '记忆',
  'education': '教育',
  'other': '其他',
};
const CAT_ORDER = ['coding agent','cli','desktop','plugin','memory','education','other'];

const state = { data: null, q: '', cat: 'all', view: 'cards' };

async function load() {
  const res = await fetch('/data/products.json', { cache: 'no-store' });
  state.data = await res.json();
  renderProof();
  renderFilters();
  render();
  document.getElementById('updatedMeta').textContent =
    `共 ${state.data.product_count} 个产品 · 抓取回复 ${state.data.posts_fetched} 条 · 更新 ${state.data.updated_at_label}`;
}

function renderProof() {
  const d = state.data;
  const cats = Object.keys(d.categories || {}).length;
  const withImg = (d.products || []).filter(p => p.image && !p.image_note).length;
  document.getElementById('proofStrip').innerHTML = [
    `<span>${d.product_count} 个产品</span>`,
    `<span>${withImg} 张实图封面</span>`,
    `<span>${cats} 个分类</span>`,
    `<span>源帖 @vista8</span>`,
  ].join('');
}

function renderFilters() {
  const wrap = document.getElementById('filters');
  const cats = CAT_ORDER.filter(c => (state.data.categories || {})[c]);
  const items = ['all', ...cats];
  wrap.innerHTML = items.map(c => {
    const label = c === 'all' ? `全部 ${state.data.product_count}` : `${CAT_LABELS[c] || c} ${state.data.categories[c]}`;
    return `<button type="button" class="chip ${state.cat===c?'active':''}" data-cat="${c}">${label}</button>`;
  }).join('');
  wrap.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.cat = btn.dataset.cat;
      renderFilters();
      render();
    });
  });
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  return (state.data.products || []).filter(p => {
    if (state.cat !== 'all' && p.category !== state.cat) return false;
    if (!q) return true;
    const blob = [p.name, p.summary, p.description, p.detail, p.url, ...(p.recommenders||[]), ...(p.tags||[])].join(' ').toLowerCase();
    return blob.includes(q);
  });
}

function metric(p, key) {
  if (key === 'like_count') {
    const n = p.like_count ?? p.likes;
    return (n == null || n === '') ? null : Number(n);
  }
  if (key === 'impression_count') {
    const n = p.impression_count ?? p.impressions;
    return (n == null || n === '') ? null : Number(n);
  }
  return null;
}

function sortedForView(list) {
  if (state.view === 'likes') {
    return [...list].sort((a, b) => {
      const av = metric(a, 'like_count');
      const bv = metric(b, 'like_count');
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av || (metric(b,'impression_count')||0) - (metric(a,'impression_count')||0);
    });
  }
  if (state.view === 'impressions') {
    return [...list].sort((a, b) => {
      const av = metric(a, 'impression_count');
      const bv = metric(b, 'impression_count');
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av || (metric(b,'like_count')||0) - (metric(a,'like_count')||0);
    });
  }
  // cards: keep likes desc as default browse order
  return [...list].sort((a, b) => (metric(b,'like_count')||0) - (metric(a,'like_count')||0));
}

function render() {
  const grid = document.getElementById('grid');
  const rank = document.getElementById('rankList');
  const list = sortedForView(filtered());
  if (state.view === 'cards') {
    grid.classList.remove('hidden');
    rank.classList.add('hidden');
    renderGrid(list);
  } else {
    grid.classList.add('hidden');
    rank.classList.remove('hidden');
    renderRank(list);
  }
}

function renderGrid(list) {
  const grid = document.getElementById('grid');
  if (!list.length) {
    grid.innerHTML = `<div class="empty">没有匹配的工具。换个关键词或分类试试。</div>`;
    return;
  }
  grid.innerHTML = list.map(p => {
    const recs = (p.recommenders || []).map(h => `@${h}`).join(' ');
    const stats = [];
    const likes = metric(p, 'like_count');
    const imps = metric(p, 'impression_count');
    if (likes != null) stats.push(`♥ ${likes}`);
    if (imps != null) stats.push(`👁 ${Number(imps).toLocaleString()}`);
    const href = `/p/${encodeURIComponent(p.slug)}/`;
    const img = p.image || '/images/products/placeholder.svg';
    return `<article class="card">
      <a class="card-media" href="${href}"><img src="${escapeAttr(img)}" alt="" loading="lazy" /></a>
      <div class="card-body">
        <div class="card-top">
          <span class="cat">${CAT_LABELS[p.category] || p.category}</span>
          <span class="stats">${stats.join(' · ')}</span>
        </div>
        <h3><a href="${href}">${escapeHtml(p.name)}</a></h3>
        <p>${escapeHtml(p.summary || p.description || '')}</p>
        <div class="card-foot">
          <span class="recs" title="${escapeHtml(recs)}">${escapeHtml(recs || '社区推荐')}</span>
          <a class="cta" href="${href}">详情</a>
        </div>
      </div>
    </article>`;
  }).join('');
}

function renderRank(list) {
  const rank = document.getElementById('rankList');
  const key = state.view === 'likes' ? 'like_count' : 'impression_count';
  const title = state.view === 'likes' ? '点赞榜' : '浏览榜';
  if (!list.length) {
    rank.innerHTML = `<div class="empty">没有匹配的工具。</div>`;
    return;
  }
  rank.innerHTML = `<h2 class="rank-title">${title}</h2>` + list.map((p, i) => {
    const likes = metric(p, 'like_count');
    const imps = metric(p, 'impression_count');
    const primary = key === 'like_count' ? likes : imps;
    const primaryLabel = primary == null ? '—' : (key === 'impression_count' ? Number(primary).toLocaleString() : String(primary));
    const secondary = key === 'like_count'
      ? (imps == null ? '浏览 —' : `浏览 ${Number(imps).toLocaleString()}`)
      : (likes == null ? '赞 —' : `赞 ${likes}`);
    const href = `/p/${encodeURIComponent(p.slug)}/`;
    const img = p.image || '';
    return `<a class="rank-item" href="${href}">
      <span class="rank-no">${i + 1}</span>
      <img class="rank-thumb" src="${escapeAttr(img)}" alt="" loading="lazy" />
      <span class="rank-main">
        <strong>${escapeHtml(p.name)}</strong>
        <em>${escapeHtml(CAT_LABELS[p.category] || p.category)} · ${escapeHtml((p.recommenders||[]).map(h=>'@'+h).join(' ') || '社区')}</em>
      </span>
      <span class="rank-metric">
        <strong>${primaryLabel}</strong>
        <em>${secondary}</em>
      </span>
    </a>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/`/g, '');
}

document.getElementById('search').addEventListener('input', (e) => {
  state.q = e.target.value;
  render();
});
document.getElementById('themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const nowDark = cur ? cur === 'dark' : prefersDark;
  const next = nowDark ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch {}
});
document.getElementById('viewTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  state.view = btn.dataset.view;
  document.querySelectorAll('#viewTabs .tab').forEach(t => {
    const on = t === btn;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  render();
});

load().catch(err => {
  document.getElementById('grid').innerHTML = `<div class="empty">加载失败：${escapeHtml(err.message)}</div>`;
});
'''

SITE_CSS = r''':root {
  --bg: #f7f5f0;
  --bg-elev: #ffffff;
  --ink: #1a1a1a;
  --muted: #5c5c5c;
  --line: rgba(26,26,26,.10);
  --accent: #b45309;
  --accent-soft: rgba(180,83,9,.10);
  --chip: #efeae2;
  --shadow: 0 10px 30px rgba(26,26,26,.06);
  --radius: 18px;
  --serif: "Noto Serif SC", "Songti SC", "Source Han Serif SC", serif;
  --sans: "Noto Sans SC", "PingFang SC", "Helvetica Neue", sans-serif;
}
html[data-theme="dark"] {
  --bg: #121212;
  --bg-elev: #1b1b1b;
  --ink: #f3efe7;
  --muted: #a8a29a;
  --line: rgba(243,239,231,.12);
  --accent: #f0b429;
  --accent-soft: rgba(240,180,41,.14);
  --chip: #262320;
  --shadow: 0 12px 36px rgba(0,0,0,.35);
}
@media (prefers-color-scheme: dark) {
  html:not([data-theme="light"]) {
    --bg: #121212;
    --bg-elev: #1b1b1b;
    --ink: #f3efe7;
    --muted: #a8a29a;
    --line: rgba(243,239,231,.12);
    --accent: #f0b429;
    --accent-soft: rgba(240,180,41,.14);
    --chip: #262320;
    --shadow: 0 12px 36px rgba(0,0,0,.35);
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--ink);
  line-height: 1.65;
  min-height: 100vh;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.hidden { display: none !important; }
.page { max-width: 1120px; margin: 0 auto; padding: 28px 22px 64px; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; margin-bottom: 42px;
}
.brand {
  color: var(--ink); font-weight: 600; letter-spacing: .02em; font-size: 14px;
}
.nav { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.nav a { color: var(--muted); font-size: 14px; }
.theme-toggle {
  border: 1px solid var(--line); background: var(--bg-elev); color: var(--ink);
  width: 34px; height: 34px; border-radius: 999px; cursor: pointer;
}
.hero { margin-bottom: 34px; max-width: 760px; }
.eyebrow {
  font-size: 13px; color: var(--muted); letter-spacing: .12em;
  text-transform: uppercase; margin: 0 0 12px;
}
.hero h1 {
  font-family: var(--serif); font-weight: 700; font-size: clamp(34px, 6vw, 56px);
  line-height: 1.15; margin: 0 0 18px; letter-spacing: -.02em;
}
.hero h1 em { font-style: normal; color: var(--accent); }
.lede { font-size: 17px; color: var(--muted); margin: 0 0 22px; }
.proof { display: flex; flex-wrap: wrap; gap: 10px; }
.proof span {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--accent-soft); color: var(--ink);
  border-radius: 999px; padding: 7px 12px; font-size: 13px; font-weight: 500;
}
.controls { display: grid; gap: 14px; margin-bottom: 22px; }
.view-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.tab {
  border: 1px solid var(--line); background: var(--bg-elev); color: var(--muted);
  border-radius: 999px; padding: 9px 16px; font-size: 14px; cursor: pointer; font-weight: 500;
}
.tab.active { background: var(--ink); color: var(--bg); border-color: transparent; }
.search-wrap input {
  width: 100%; border: 1px solid var(--line); background: var(--bg-elev);
  color: var(--ink); border-radius: 14px; padding: 14px 16px; font-size: 15px;
  outline: none; box-shadow: var(--shadow);
}
.search-wrap input:focus { border-color: var(--accent); }
.filters { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  border: 1px solid var(--line); background: var(--chip); color: var(--muted);
  border-radius: 999px; padding: 7px 12px; font-size: 13px; cursor: pointer;
}
.chip.active { background: var(--ink); color: var(--bg); border-color: transparent; }
.grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px; margin-bottom: 48px;
}
.card {
  background: var(--bg-elev); border: 1px solid var(--line); border-radius: var(--radius);
  overflow: hidden; box-shadow: var(--shadow);
  display: flex; flex-direction: column;
  transition: transform .18s ease, border-color .18s ease;
}
.card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); }
.card-media { display: block; aspect-ratio: 16/9; background: var(--chip); overflow: hidden; }
.card-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.card-body { padding: 16px 18px 16px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
.card-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
.cat {
  font-size: 12px; color: var(--accent); background: var(--accent-soft);
  border-radius: 999px; padding: 4px 9px; white-space: nowrap;
}
.stats { font-size: 12px; color: var(--muted); white-space: nowrap; }
.card h3 {
  font-family: var(--serif); font-size: 22px; line-height: 1.25; margin: 0;
  letter-spacing: -.01em;
}
.card h3 a { color: inherit; text-decoration: none; }
.card h3 a:hover { color: var(--accent); }
.card p { margin: 0; color: var(--muted); font-size: 14px; flex: 1; }
.card-foot {
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
  border-top: 1px solid var(--line); padding-top: 12px; margin-top: 4px;
}
.recs { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cta {
  font-size: 13px; font-weight: 600; color: var(--ink);
  border: 1px solid var(--line); border-radius: 999px; padding: 6px 11px;
  background: transparent;
}
.cta:hover { background: var(--ink); color: var(--bg); text-decoration: none; }
.rank-list { display: grid; gap: 10px; margin-bottom: 48px; }
.rank-title { font-family: var(--serif); font-size: 28px; margin: 0 0 8px; }
.rank-item {
  display: grid; grid-template-columns: 40px 64px 1fr auto; gap: 14px; align-items: center;
  background: var(--bg-elev); border: 1px solid var(--line); border-radius: 16px;
  padding: 12px 14px; color: inherit; text-decoration: none; box-shadow: var(--shadow);
}
.rank-item:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); text-decoration: none; }
.rank-no {
  font-family: var(--serif); font-size: 22px; color: var(--accent); text-align: center;
}
.rank-thumb {
  width: 64px; height: 64px; border-radius: 12px; object-fit: cover; background: var(--chip);
}
.rank-main { display: grid; gap: 2px; min-width: 0; }
.rank-main strong { font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-main em { font-style: normal; font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-metric { text-align: right; display: grid; gap: 2px; }
.rank-metric strong { font-size: 18px; font-variant-numeric: tabular-nums; }
.rank-metric em { font-style: normal; font-size: 12px; color: var(--muted); }
.empty {
  grid-column: 1 / -1; text-align: center; color: var(--muted); padding: 48px 12px;
}
.note {
  border-top: 1px solid var(--line); padding-top: 28px; max-width: 720px;
}
.note h2 { font-family: var(--serif); font-size: 24px; margin: 0 0 10px; }
.note p { color: var(--muted); margin: 0 0 10px; }
.meta { font-size: 13px; }
.footer {
  margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--line);
  color: var(--muted); font-size: 14px;
}
.footer .small { font-size: 12px; opacity: .85; }

/* detail */
.crumb { color: var(--muted); font-size: 13px; margin: 0 0 18px; }
.crumb a { color: var(--muted); }
.detail {
  display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 28px; margin-bottom: 40px; align-items: start;
}
.hero-media img {
  width: 100%; border-radius: 20px; border: 1px solid var(--line);
  aspect-ratio: 16/10; object-fit: cover; background: var(--chip); box-shadow: var(--shadow);
}
.image-note { font-size: 12px; color: var(--muted); margin: 8px 0 0; }
.detail-top { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.detail h1 {
  font-family: var(--serif); font-size: clamp(28px, 5vw, 42px);
  line-height: 1.2; margin: 0 0 12px;
}
.summary { color: var(--muted); font-size: 17px; margin: 0 0 14px; }
.tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.tag {
  font-size: 12px; padding: 4px 10px; border-radius: 999px;
  background: var(--chip); color: var(--muted);
}
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
.btn {
  display: inline-flex; align-items: center; border: 1px solid var(--line);
  border-radius: 999px; padding: 8px 14px; font-size: 14px; font-weight: 600;
  color: var(--ink); background: var(--bg-elev);
}
.btn:hover { text-decoration: none; border-color: var(--accent); }
.btn.primary { background: var(--ink); color: var(--bg); border-color: transparent; }
.btn.ghost { color: var(--muted); }
.writeup h2 { font-family: var(--serif); font-size: 22px; margin: 0 0 10px; }
.writeup p { color: var(--muted); margin: 0 0 12px; }
.recs-line { font-size: 14px; color: var(--muted); }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-top: 18px; }
.gallery img { width: 100%; border-radius: 12px; aspect-ratio: 1; object-fit: cover; border: 1px solid var(--line); }
.related { margin-top: 12px; }
.related h2 { font-family: var(--serif); font-size: 24px; margin: 0 0 14px; }
.related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.related-card {
  display: grid; grid-template-columns: 72px 1fr; gap: 12px; align-items: center;
  padding: 10px; border-radius: 14px; border: 1px solid var(--line);
  background: var(--bg-elev); color: inherit; text-decoration: none;
}
.related-card:hover { text-decoration: none; border-color: var(--accent); }
.related-card img { width: 72px; height: 72px; object-fit: cover; border-radius: 10px; background: var(--chip); }
.related-card strong { display: block; font-size: 14px; margin-bottom: 4px; }
.related-card span { display: block; font-size: 12px; color: var(--muted); overflow: hidden; max-height: 2.6em; }

@media (max-width: 860px) {
  .detail { grid-template-columns: 1fr; }
  .rank-item { grid-template-columns: 32px 52px 1fr; }
  .rank-metric { grid-column: 2 / -1; text-align: left; padding-left: 0; }
}
@media (max-width: 640px) {
  .page { padding: 18px 14px 48px; }
  .card h3 { font-size: 20px; }
}
'''


def main():
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    catalog, expansions, posts_by_id, cand_by_reply, url_images, reply_images = load_sources()
    products = catalog["products"]
    print(f"enriching {len(products)} products…", flush=True)
    used_slugs = set()
    enriched = []
    # sequential for polite rate limits on github/pages; still OK for 78
    for i, p in enumerate(products, 1):
        print(f"[{i}/{len(products)}] {p['name']}", flush=True)
        try:
            e = enrich_one(p, expansions, posts_by_id, cand_by_reply, url_images, reply_images, used_slugs)
        except Exception as ex:
            print("  ERROR", ex, flush=True)
            # minimal fallback
            slug = slugify(p["name"], p["id"])
            while slug in used_slugs:
                slug = slug + "-x"
            used_slugs.add(slug)
            ph = IMG_DIR / f"{slug}.svg"
            img = make_placeholder_svg(p["name"], p["category"], ph)
            e = {
                "id": p["id"],
                "name": p["name"],
                "slug": slug,
                "summary": p.get("description") or "",
                "detail": p.get("description") or "",
                "category": p["category"],
                "url": p.get("url"),
                "repo_url": None,
                "recommenders": p.get("recommenders") or [],
                "source_reply_urls": [r["url"] for r in (p.get("replies") or []) if r.get("url")],
                "replies": p.get("replies") or [],
                "image": img,
                "gallery": None,
                "image_note": f"抓取失败：{ex}",
                "tags": [CAT_LABELS.get(p["category"], p["category"])],
                "pricing": None,
                "stars": None,
                "likes": p.get("likes") or 0,
                "bookmarks": p.get("bookmarks") or 0,
                "impressions": None,
                "like_count": p.get("likes") or 0,
                "impression_count": None,
                "updated": now_label()[1],
            }
        enriched.append(e)
        has = "IMG" if not e.get("image_note") else "PH"
        print(f"  -> {e['slug']} {has} likes={e.get('like_count')} imps={e.get('impression_count')}", flush=True)

    iso, label = now_label()
    catalog["products"] = enriched
    catalog["product_count"] = len(enriched)
    catalog["updated_at"] = iso
    catalog["updated_at_label"] = label
    catalog["enrichment"] = {
        "with_real_image": sum(1 for p in enriched if not p.get("image_note")),
        "with_placeholder": sum(1 for p in enriched if p.get("image_note")),
        "with_impressions": sum(1 for p in enriched if p.get("impression_count")),
    }
    # categories recount
    cats = {}
    for p in enriched:
        cats[p["category"]] = cats.get(p["category"], 0) + 1
    catalog["categories"] = cats

    # clear old detail pages
    pdir = PUBLIC / "p"
    if pdir.exists():
        for child in pdir.iterdir():
            if child.is_dir():
                for f in child.glob("*"):
                    f.unlink()
                child.rmdir()

    write_site_files(catalog)
    print("DONE", catalog["enrichment"], flush=True)
    print("sample", enriched[0]["slug"], enriched[0]["image"], flush=True)


if __name__ == "__main__":
    main()
