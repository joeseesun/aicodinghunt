# Design tokens — AI Coding Hunt (Yarrow card language)

Visual language adapted from a card/marketplace results pattern. Brand copy is **AI Coding Hunt / 乔木 AI 工具猎场** only — no third-party product names or logos.

## Color
| Token | Hex | Use |
|-------|-----|-----|
| ink | `#0f1219` | Primary text, titles |
| ink-2 | `#39404d` | Secondary text, nav |
| ink-3 | `#6b727f` | Muted / lead |
| ink-4 | `#8f96a3` | Quaternary |
| line | `#d9dfea` | Borders |
| line-soft | `#e3e8f2` | Soft dividers |
| canvas | `#f5f7fc` | Page background |
| surface | `#fbfcff` | Nav / card chrome |
| chip | `#e6ebf4` | Search / chip fill |
| chip-hover | `#dbe1ec` | Chip hover |
| accent | `#c0492f` | CTA / search button |
| accent-hi | `#d0573b` | Accent hover |
| live | `#4f9a6a` | Online / success |
| bolt | `#d79a2b` | Hot / lightning |

## Radius
- sm: `8px`
- md: `12px` (image tiles)
- pill: `999px`

## Motion
- ease: `cubic-bezier(0.16, 1, 0.3, 1)`
- tile hover: `translateY(-3px)` + deeper shadow

## Shadow (tile)
`0 1px 2px rgba(15,18,25,.05), 0 14px 30px -20px rgba(15,18,25,.35)`  
Hover: `0 2px 4px rgba(15,18,25,.06), 0 22px 38px -22px rgba(15,18,25,.45)`

## Layout
- shell max: `1440px`
- gutter: `38px` (mobile `20px`)
- grid gap: `44px` row / `22px` column
- columns: 4 → 3 (≤1280) → 2 (≤900) → 1 (≤560)

## Type
- System UI stack; body ~15px / 1.45
- Card title: 17px / 700 / -0.015em
- Wordmark: ~25px / 750
- Head h1: 31px / 450 with **strong** 750

## Components
- Nav: wordmark + large pill search (chip bg + red round search)
- Popular / category chips; filter pills
- Card: 4:3 image tile r-12 + title + meta (avatar/recommender) + metric row (likes/views as bold nums; bolt optional for hot)
