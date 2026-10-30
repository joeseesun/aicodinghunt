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
    """Sync products.json for the React/Vite frontend (SPA handles pages)."""
    products = catalog["products"]
    PUBLIC.mkdir(parents=True, exist_ok=True)
    (PUBLIC / "data").mkdir(parents=True, exist_ok=True)
    (PUBLIC / "data" / "products.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (DATA / "products.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"wrote data → public/data/products.json ({len(products)} products); SPA UI unchanged")



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
