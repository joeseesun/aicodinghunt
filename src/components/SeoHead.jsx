import { useEffect } from 'react'

const SITE = 'https://aicodinghunt.qiaomu.ai'
const SITE_NAME = 'AI Coding Hunt · 乔木 AI 工具猎场'
const DEFAULT_DESC =
  '来自 @vista8 社区自荐的 AI Coding 工具、Agent、插件与开源项目目录。可检索、可排序，中文优先。'
const DEFAULT_OG = `${SITE}/icon-512.png`

function upsertMeta(attr, key, content) {
  if (content == null || content === '') return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function upsertJsonLd(id, data) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

/**
 * Client-side SEO/GEO head updates (title, description, OG, Twitter, canonical, JSON-LD).
 */
export default function SeoHead({
  title,
  description,
  path = '/',
  image,
  type = 'website',
  jsonLd,
}) {
  useEffect(() => {
    const fullTitle = title ? `${title} · 乔木 AI 工具猎场` : SITE_NAME
    const desc = description || DEFAULT_DESC
    const url = `${SITE}${path.startsWith('/') ? path : `/${path}`}`
    const img = image
      ? image.startsWith('http')
        ? image
        : `${SITE}${image}`
      : DEFAULT_OG

    document.title = fullTitle
    document.documentElement.lang = 'zh-CN'

    upsertMeta('name', 'description', desc)
    upsertMeta('name', 'keywords', 'AI Coding,Agent,开源工具,X社区,vista8,乔木,AI工具猎场')
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', desc)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:image', img)
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:locale', 'zh_CN')
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', desc)
    upsertMeta('name', 'twitter:image', img)
    upsertLink('canonical', url)

    if (jsonLd) {
      upsertJsonLd('ach-jsonld', jsonLd)
    }
  }, [title, description, path, image, type, jsonLd])

  return null
}

export { SITE, SITE_NAME, DEFAULT_DESC }
