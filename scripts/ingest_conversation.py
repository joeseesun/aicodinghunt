#!/usr/bin/env python3
"""
Incremental ingest helper for conversation_id 2115318655525523714.

This script does NOT call X APIs by itself (credentials live outside the repo).
It documents / automates the local merge step after you refresh raw pages:

  1) Fetch new replies into raw/page_NNN.json (or refresh raw/all_posts.json)
     conversation_id = 2115318655525523714
  2) Re-run candidate extraction / enrich as your pipeline does
  3) python3 scripts/fetch_avatars.py
  4) python3 scripts/enrich_and_build.py   # optional live refetch
  5) npm run build && wrangler deploy

Usage (merge-only dry check):

  python3 scripts/ingest_conversation.py --check
  python3 scripts/ingest_conversation.py --sync-public
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
DATA = ROOT / "data" / "products.json"
CONV = "2115318655525523714"


def check():
    posts = json.loads((RAW / "all_posts.json").read_text(encoding="utf-8"))
    n = len(posts.get("posts") or [])
    catalog = json.loads(DATA.read_text(encoding="utf-8"))
    print(f"conversation_id={CONV}")
    print(f"raw posts={n} products={catalog.get('product_count')} updated={catalog.get('updated_at_label')}")
    print("Next: refresh raw replies → enrich_and_build.py → fetch_avatars.py → npm run build → deploy")


def sync_public():
    text = DATA.read_text(encoding="utf-8")
    dest = ROOT / "public" / "data" / "products.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text, encoding="utf-8")
    print("synced data/products.json → public/data/products.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--sync-public", action="store_true")
    args = ap.parse_args()
    if args.sync_public:
        sync_public()
    else:
        check()


if __name__ == "__main__":
    main()
