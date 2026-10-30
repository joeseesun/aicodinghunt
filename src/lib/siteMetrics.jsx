import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const SiteMetricsContext = createContext(null)

const VISITOR_KEY = 'ach_vid'

function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      id = crypto.randomUUID()
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

function metricHeaders(extra = {}) {
  const h = { ...extra }
  const vid = getVisitorId()
  if (vid) h['X-ACH-Visitor'] = vid
  return h
}


async function fetchJson(url, opts) {
  const res = await fetch(url, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export function SiteMetricsProvider({ children, slugs = [] }) {
  const [metrics, setMetrics] = useState({})
  const viewedRef = useRef(new Set())
  const pendingSlugs = useRef(new Set())
  const flushTimer = useRef(null)

  const merge = useCallback((partial) => {
    setMetrics((prev) => {
      const next = { ...prev }
      for (const [slug, m] of Object.entries(partial || {})) {
        next[slug] = { ...(next[slug] || {}), ...m }
      }
      return next
    })
  }, [])

  const loadSlugs = useCallback(
    async (list) => {
      const unique = [...new Set((list || []).filter(Boolean))]
      if (!unique.length) return
      // batch in chunks of 80
      for (let i = 0; i < unique.length; i += 80) {
        const chunk = unique.slice(i, i + 80)
        const q = chunk.map(encodeURIComponent).join(',')
        try {
          const data = await fetchJson(`/api/metrics?slugs=${q}`, { headers: metricHeaders() })
          if (data.metrics) merge(data.metrics)
        } catch {
          /* offline / local vite without worker */
        }
      }
    },
    [merge],
  )

  // schedule load when slugs prop changes
  useEffect(() => {
    if (!slugs?.length) return
    loadSlugs(slugs)
  }, [slugs, loadSlugs])

  const ensureLoaded = useCallback(
    (slugList) => {
      for (const s of slugList || []) {
        if (s) pendingSlugs.current.add(s)
      }
      if (flushTimer.current) return
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null
        const batch = [...pendingSlugs.current]
        pendingSlugs.current.clear()
        const missing = batch.filter((s) => !metrics[s])
        if (missing.length) loadSlugs(missing)
      }, 50)
    },
    [loadSlugs, metrics],
  )

  const recordView = useCallback(
    async (slug) => {
      if (!slug || viewedRef.current.has(slug)) return null
      viewedRef.current.add(slug)
      try {
        const data = await fetchJson('/api/view', {
          method: 'POST',
          headers: metricHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({ slug }),
        })
        merge({
          [slug]: {
            site_views: data.site_views,
            site_upvotes: data.site_upvotes,
            voted: data.voted,
          },
        })
        return data
      } catch {
        return null
      }
    },
    [merge],
  )

  const toggleUpvote = useCallback(
    async (slug) => {
      if (!slug) return null
      const prev = metrics[slug] || { site_views: 0, site_upvotes: 0, voted: false }
      const nextVoted = !prev.voted
      const optimistic = {
        ...prev,
        voted: nextVoted,
        site_upvotes: Math.max(0, (prev.site_upvotes || 0) + (nextVoted ? 1 : -1)),
      }
      merge({ [slug]: optimistic })
      try {
        const data = await fetchJson('/api/upvote', {
          method: 'POST',
          headers: metricHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({ slug, action: 'toggle' }),
        })
        merge({
          [slug]: {
            site_views: data.site_views,
            site_upvotes: data.site_upvotes,
            voted: data.voted,
          },
        })
        return data
      } catch (err) {
        merge({ [slug]: prev })
        throw err
      }
    },
    [merge, metrics],
  )

  const value = useMemo(
    () => ({
      metrics,
      get: (slug) => metrics[slug] || { site_views: 0, site_upvotes: 0, voted: false },
      loadSlugs,
      ensureLoaded,
      recordView,
      toggleUpvote,
    }),
    [metrics, loadSlugs, ensureLoaded, recordView, toggleUpvote],
  )

  return <SiteMetricsContext.Provider value={value}>{children}</SiteMetricsContext.Provider>
}

export function useSiteMetrics() {
  const ctx = useContext(SiteMetricsContext)
  if (!ctx) {
    return {
      metrics: {},
      get: () => ({ site_views: 0, site_upvotes: 0, voted: false }),
      loadSlugs: async () => {},
      ensureLoaded: () => {},
      recordView: async () => null,
      toggleUpvote: async () => null,
    }
  }
  return ctx
}
