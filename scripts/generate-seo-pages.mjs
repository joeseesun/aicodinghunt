#!/usr/bin/env node
/**
 * After Vite build: write dist/p/{slug}/index.html with per-product meta + SPA shell.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const productsPath = join(dist, 'data', 'products.json')
if (!existsSync(productsPath)) {
  console.error('missing dist/data/products.json — run vite build first')
  process.exit(1)
}

const catalog = JSON.parse(readFileSync(productsPath, 'utf8'))
const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8')
const SITE = 'https://aicodinghunt.qiaomu.ai'

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function abs(img) {
  if (!img) return `${SITE}/icon-512.png`
  if (img.startsWith('http')) return img
  return `${SITE}${img}`
}

function setMeta(html, attr, key, content) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, 'i')
  const tag = `<meta ${attr}="${key}" content="${esc(content)}" />`
  if (re.test(html)) return html.replace(re, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function setLink(html, rel, href) {
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, 'i')
  const tag = `<link rel="${rel}" href="${esc(href)}" />`
  if (re.test(html)) return html.replace(re, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

let n = 0
for (const p of catalog.products || []) {
  const path = `/p/${encodeURIComponent(p.slug)}/`
  const title = `${p.name} · 乔木 AI 工具猎场`
  const desc = p.summary || `${p.name} — AI Coding Hunt 收录`
  const url = `${SITE}${path}`
  const image = abs(p.image)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: p.name,
    description: p.summary || p.name,
    url: p.url || url,
    image,
    applicationCategory: p.category,
  }

  let html = indexHtml
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
  html = setMeta(html, 'name', 'description', desc)
  html = setLink(html, 'canonical', url)
  html = setMeta(html, 'property', 'og:title', title)
  html = setMeta(html, 'property', 'og:description', desc)
  html = setMeta(html, 'property', 'og:url', url)
  html = setMeta(html, 'property', 'og:type', 'article')
  html = setMeta(html, 'property', 'og:image', image)
  html = setMeta(html, 'name', 'twitter:card', 'summary_large_image')
  html = setMeta(html, 'name', 'twitter:title', title)
  html = setMeta(html, 'name', 'twitter:description', desc)
  html = setMeta(html, 'name', 'twitter:image', image)

  // Replace first JSON-LD block with product schema
  const ld = `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
  if (/<script type="application\/ld\+json">[\s\S]*?<\/script>/.test(html)) {
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, ld)
  } else {
    html = html.replace('</head>', `    ${ld}\n  </head>`)
  }

  const outDir = join(dist, 'p', p.slug)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), html, 'utf8')
  n++
}
console.log(`SEO pages: ${n} product HTML shells written under dist/p/`)
