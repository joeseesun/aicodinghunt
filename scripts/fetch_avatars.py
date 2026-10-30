#!/usr/bin/env python3
"""Download real X avatars via unavatar into public/images/avatars/{handle}.* and patch products.json."""
from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "products.json"
PUBLIC_DATA = ROOT / "public" / "data" / "products.json"
AVATAR_DIR = ROOT / "public" / "images" / "avatars"


def download(handle: str) -> str | None:
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        cand = AVATAR_DIR / f"{handle}{ext}"
        if cand.exists() and cand.stat().st_size > 500:
            return f"/images/avatars/{cand.name}"
    url = f"https://unavatar.io/x/{handle}?fallback=false"
    tmp = AVATAR_DIR / f".tmp-{handle}"
    cmd = [
        "curl", "-sL", "--max-time", "20",
        "-A", "Mozilla/5.0 (compatible; AICodingHuntBot/1.0)",
        "-o", str(tmp), "-w", "%{http_code}|%{content_type}", url,
    ]
    r = subprocess.run(cmd, capture_output=True, timeout=28)
    meta = r.stdout.decode("utf-8", "replace").strip()
    code = int(meta.split("|")[0]) if meta.split("|")[0].isdigit() else 0
    ctype = meta.split("|")[1] if "|" in meta else ""
    size = tmp.stat().st_size if tmp.exists() else 0
    if code == 200 and size > 500 and "image" in ctype:
        ext = ".jpg"
        if "png" in ctype:
            ext = ".png"
        elif "webp" in ctype:
            ext = ".webp"
        dest = AVATAR_DIR / f"{handle}{ext}"
        if dest.exists():
            dest.unlink()
        tmp.rename(dest)
        return f"/images/avatars/{dest.name}"
    tmp.unlink(missing_ok=True)
    return None


def main():
    catalog = json.loads(DATA.read_text(encoding="utf-8"))
    handles = set()
    for p in catalog["products"]:
        for h in p.get("recommenders") or []:
            handles.add(str(h).lstrip("@"))
    avatars = dict(catalog.get("avatars") or {})
    for i, h in enumerate(sorted(handles), 1):
        if h in avatars and (ROOT / "public" / avatars[h].lstrip("/")).exists():
            print(f"[{i}/{len(handles)}] {h} cached")
            continue
        path = download(h)
        if path:
            avatars[h] = path
            print(f"[{i}/{len(handles)}] {h} OK")
        else:
            print(f"[{i}/{len(handles)}] {h} FAIL")
        time.sleep(0.12)
    catalog["avatars"] = avatars
    catalog["avatar_count"] = len(avatars)
    for p in catalog["products"]:
        avmap = {}
        for h in p.get("recommenders") or []:
            key = str(h).lstrip("@")
            if key in avatars:
                avmap[key] = avatars[key]
        p["avatars"] = avmap or None
    text = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
    DATA.write_text(text, encoding="utf-8")
    PUBLIC_DATA.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA.write_text(text, encoding="utf-8")
    print("done", len(avatars))


if __name__ == "__main__":
    main()
