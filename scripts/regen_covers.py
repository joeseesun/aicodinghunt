#!/usr/bin/env python3
"""Regenerate branded left-bar product covers into clean Yarrow-style 4:3 tiles."""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
DATA = ROOT / "data" / "products.json"
IMG_DIR = PUBLIC / "images" / "products"

CAT_LABELS = {
    "coding agent": "Coding Agent",
    "cli": "CLI",
    "desktop": "桌面应用",
    "plugin": "插件 / Skill",
    "memory": "记忆",
    "education": "教育",
    "other": "其他",
}

# Soft category tints (bg wash, chip, accent)
CAT_TINTS = {
    "coding agent": ((232, 236, 245), (55, 65, 90), (192, 73, 47)),
    "cli": ((232, 240, 236), (45, 90, 70), (79, 154, 106)),
    "desktop": ((236, 234, 245), (70, 60, 110), (99, 102, 241)),
    "plugin": ((245, 236, 232), (110, 60, 50), (192, 73, 47)),
    "memory": ((236, 242, 245), (50, 80, 100), (14, 116, 144)),
    "education": ((245, 240, 232), (110, 80, 40), (215, 154, 43)),
    "other": ((236, 238, 242), (70, 75, 90), (107, 114, 127)),
}

FONT_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

W, H = 1200, 900


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size, index=0)
    except Exception:
        return ImageFont.load_default()


def is_branded_card(path: Path) -> bool:
    try:
        im = Image.open(path).convert("RGB")
    except Exception:
        return False
    if im.size != (W, H):
        return False
    arr = np.asarray(im.resize((400, 300)))
    white_frac = float((arr.mean(axis=2) > 245).mean())
    return white_frac > 0.55


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_w: int) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    lines: list[str] = []
    # Prefer wrapping on spaces / punctuation for CJK mix
    buf = ""
    for ch in text:
        trial = buf + ch
        if draw.textlength(trial, font=fnt) <= max_w:
            buf = trial
        else:
            if buf:
                lines.append(buf)
            buf = ch
        if len(lines) >= 3:
            break
    if buf and len(lines) < 3:
        lines.append(buf)
    if len(lines) == 3 and draw.textlength(lines[-1] + "…", font=fnt) > max_w:
        while lines[-1] and draw.textlength(lines[-1] + "…", font=fnt) > max_w:
            lines[-1] = lines[-1][:-1]
        lines[-1] = lines[-1] + "…"
    return lines


def render_cover(name: str, summary: str, category: str, dest: Path) -> None:
    wash, ink_soft, accent = CAT_TINTS.get(category, CAT_TINTS["other"])
    img = Image.new("RGB", (W, H), wash)
    draw = ImageDraw.Draw(img)

    # Soft geometric accents (no glow orbs)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([780, -120, 1280, 380], fill=(*accent, 18))
    od.ellipse([-180, 520, 420, 1120], fill=(*ink_soft, 14))
    od.rounded_rectangle([860, 480, 1140, 760], radius=36, outline=(*accent, 28), width=3)
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Inner clean surface panel (subtle, not floating card-in-card)
    panel = [56, 56, W - 56, H - 56]
    draw.rounded_rectangle(panel, radius=28, fill=(251, 252, 255), outline=(217, 223, 234), width=2)

    f_chip = font(FONT_BOLD, 28)
    f_title = font(FONT_BOLD, 72)
    f_body = font(FONT_REG, 36)
    f_brand = font(FONT_BOLD, 28)
    f_mark = font(FONT_BOLD, 120)

    cat = CAT_LABELS.get(category, category or "其他")
    chip_pad_x, chip_pad_y = 22, 12
    chip_w = draw.textlength(cat, font=f_chip) + chip_pad_x * 2
    chip_h = 28 + chip_pad_y * 2
    chip_box = [96, 100, 96 + chip_w, 100 + chip_h]
    draw.rounded_rectangle(chip_box, radius=999, fill=(230, 235, 244))
    draw.text((96 + chip_pad_x, 100 + chip_pad_y - 2), cat, font=f_chip, fill=(57, 64, 77))

    # Large faint initial
    initial = (name or "?").strip()[:1] or "?"
    draw.text((880, 280), initial, font=f_mark, fill=(*accent, ) if False else accent)
    # soften initial by overlaying semi-transparent white
    soft = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(soft)
    sd.text((880, 280), initial, font=f_mark, fill=(*accent, 36))
    img = Image.alpha_composite(img.convert("RGBA"), soft).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Title
    title_lines = wrap(draw, name, f_title, 780)
    y = 210
    for line in title_lines[:2]:
        draw.text((96, y), line, font=f_title, fill=(15, 18, 25))
        y += 88

    # Summary
    y += 12
    for line in wrap(draw, summary or "", f_body, 780)[:3]:
        draw.text((96, y), line, font=f_body, fill=(107, 114, 127))
        y += 52

    # Brand row
    draw.ellipse([96, 760, 96 + 36, 760 + 36], fill=accent)
    # simple mark: white A-like triangle via text
    f_icon = font(FONT_BOLD, 22)
    tw = draw.textlength("A", font=f_icon)
    draw.text((96 + (36 - tw) / 2, 764), "A", font=f_icon, fill=(255, 255, 255))
    draw.text((148, 764), "AI Coding Hunt", font=f_brand, fill=(57, 64, 77))

    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "JPEG", quality=90, optimize=True)


def main() -> None:
    catalog = json.loads(DATA.read_text(encoding="utf-8"))
    n = 0
    for p in catalog.get("products") or []:
        rel = (p.get("image") or "").lstrip("/")
        if not rel:
            continue
        path = PUBLIC / rel
        if not path.exists() or not is_branded_card(path):
            continue
        render_cover(
            p.get("name") or "Untitled",
            p.get("summary") or "",
            p.get("category") or "other",
            path,
        )
        n += 1
        print("regenerated", path.name)
    # also refresh placeholder.svg style note — skip
    print(f"done: {n} covers")


if __name__ == "__main__":
    main()
