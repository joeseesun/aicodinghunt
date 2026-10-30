export function metric(p, key) {
  if (key === 'like_count') {
    const n = p.like_count ?? p.likes
    return n == null || n === '' ? null : Number(n)
  }
  if (key === 'impression_count') {
    const n = p.impression_count ?? p.impressions
    return n == null || n === '' ? null : Number(n)
  }
  if (key === 'bookmark_count') {
    const n = p.bookmarks ?? p.bookmark_count
    return n == null || n === '' ? null : Number(n)
  }
  if (key === 'site_upvotes') {
    const n = p.site_upvotes
    return n == null || n === '' ? null : Number(n)
  }
  if (key === 'site_views') {
    const n = p.site_views
    return n == null || n === '' ? null : Number(n)
  }
  return null
}

export function formatNum(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('zh-CN')
}

export function isHot(p) {
  const likes = metric(p, 'like_count')
  const imps = metric(p, 'impression_count')
  return (likes != null && likes >= 10) || (imps != null && imps >= 2000)
}

export function sortedForView(list, view, siteMetricsMap) {
  const siteU = (p) => {
    const fromMap = siteMetricsMap?.[p.slug]?.site_upvotes
    if (fromMap != null) return Number(fromMap) || 0
    return metric(p, 'site_upvotes') || 0
  }
  const siteV = (p) => {
    const fromMap = siteMetricsMap?.[p.slug]?.site_views
    if (fromMap != null) return Number(fromMap) || 0
    return metric(p, 'site_views') || 0
  }

  if (view === 'site') {
    return [...list].sort(
      (a, b) =>
        siteU(b) - siteU(a) ||
        siteV(b) - siteV(a) ||
        (metric(b, 'like_count') || 0) - (metric(a, 'like_count') || 0),
    )
  }
  if (view === 'likes') {
    return [...list].sort((a, b) => {
      const av = metric(a, 'like_count')
      const bv = metric(b, 'like_count')
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return bv - av || (metric(b, 'impression_count') || 0) - (metric(a, 'impression_count') || 0)
    })
  }
  if (view === 'impressions') {
    return [...list].sort((a, b) => {
      const av = metric(a, 'impression_count')
      const bv = metric(b, 'impression_count')
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return bv - av || (metric(b, 'like_count') || 0) - (metric(a, 'like_count') || 0)
    })
  }
  // default cards: prefer site upvotes then community likes
  return [...list].sort(
    (a, b) =>
      siteU(b) - siteU(a) ||
      (metric(b, 'like_count') || 0) - (metric(a, 'like_count') || 0),
  )
}

const PLACEHOLDER = '/images/avatars/_placeholder.svg'

/** Resolve local X avatar path; null if unknown (caller may try catalog map). */
export function resolveAvatar(handle, map) {
  const key = String(handle || '').replace(/^@/, '')
  if (!key || !map) return null
  return map[key] || null
}

/** Prefer product.avatars, then catalog avatars map, then placeholder. */
export function avatarUrl(handle, product, catalogAvatars) {
  const key = String(handle || 'community').replace(/^@/, '')
  return (
    resolveAvatar(key, product?.avatars) ||
    resolveAvatar(key, catalogAvatars) ||
    resolveAvatar(key, product?.avatar_map) ||
    PLACEHOLDER
  )
}

export function xProfileUrl(handle) {
  const key = String(handle || '').replace(/^@/, '').trim()
  if (!key) return 'https://x.com'
  return `https://x.com/${encodeURIComponent(key)}`
}

/** Card blurb: prefer summary ≤40 chars; else compress detail. */
export function cardSummary(p, limit = 40) {
  const raw = (p?.summary || '').trim()
  if (raw && raw.length <= limit) return raw
  const src = raw || (p?.detail || p?.description || '')
  const cleaned = String(src)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^求推荐[:：]?\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length <= limit) return cleaned
  const first = cleaned.split(/[。！？\n]/)[0]?.trim() || cleaned
  if (first.length >= 8 && first.length <= limit) return first
  const cut = cleaned.slice(0, limit)
  for (const sep of ['，', '、', ',', ' ']) {
    const i = cut.lastIndexOf(sep)
    if (i >= 16) return cut.slice(0, i).replace(/[，、,\s]+$/, '')
  }
  return cut.replace(/[，、,\s]+$/, '') + '…'
}
