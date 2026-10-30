export function metric(p, key) {
  if (key === 'like_count') {
    const n = p.like_count ?? p.likes
    return n == null || n === '' ? null : Number(n)
  }
  if (key === 'impression_count') {
    const n = p.impression_count ?? p.impressions
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

export function sortedForView(list, view) {
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
  return [...list].sort(
    (a, b) => (metric(b, 'like_count') || 0) - (metric(a, 'like_count') || 0),
  )
}

export function avatarUrl(handle) {
  const name = encodeURIComponent(String(handle || 'community').replace(/^@/, ''))
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${name}&size=48`
}
