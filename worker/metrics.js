/**
 * First-party site metrics via Durable Object (strong consistency).
 *
 * Dedup policy (see README):
 * - site_views: once per visitor-key per product per UTC day
 * - site_upvotes: once per visitor-key per product lifetime (toggleable)
 *
 * Visitor-key resolution (in order):
 * 1. X-ACH-Visitor header — UUID from localStorage (survives NAT / mobile IP churn)
 * 2. Else SHA-256(CF-Connecting-IP + "|" + slug)
 *
 * Raw IP is never written to public JSON. Optional KV mirror of aggregate counts.
 * Lifetime upvote (not 24h cooldown) mirrors Product Hunt’s one-vote ranking feel.
 */

const MAX_SLUGS = 200
const SLUG_RE = /^[^\s/?#]{1,120}$/u
const VISITOR_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handleMetricsApi(request, env, url) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (!env.PRODUCT_METRICS) {
    return json({ error: 'PRODUCT_METRICS Durable Object not bound' }, 503)
  }

  const path = url.pathname.replace(/\/$/, '') || url.pathname
  const visitor = readVisitor(request)
  const ip = clientIp(request)

  if (path === '/api/view' && request.method === 'POST') {
    const body = await readJson(request)
    const slug = normalizeSlug(body?.slug)
    if (!slug) return json({ error: 'slug required' }, 400)
    return forwardToDo(env, slug, { op: 'view', ip, visitor })
  }

  if (path === '/api/upvote' && request.method === 'POST') {
    const body = await readJson(request)
    const slug = normalizeSlug(body?.slug)
    if (!slug) return json({ error: 'slug required' }, 400)
    const action = String(body?.action || 'toggle').toLowerCase()
    return forwardToDo(env, slug, { op: 'upvote', action, ip, visitor })
  }

  if (path === '/api/metrics' && request.method === 'GET') {
    const raw = url.searchParams.get('slugs') || ''
    const slugs = raw
      .split(',')
      .map((s) => normalizeSlug(decodeURIComponent(s.trim())))
      .filter(Boolean)
      .slice(0, MAX_SLUGS)
    if (!slugs.length) return json({ error: 'slugs query required (comma-separated)' }, 400)

    const metrics = {}
    await Promise.all(
      slugs.map(async (slug) => {
        const res = await forwardToDo(env, slug, { op: 'get', ip, visitor })
        const data = await res.json()
        metrics[slug] = {
          site_views: data.site_views || 0,
          site_upvotes: data.site_upvotes || 0,
          voted: Boolean(data.voted),
        }
      }),
    )
    return json({ ok: true, metrics })
  }

  if (path.startsWith('/api/metrics/') && request.method === 'GET') {
    const slug = normalizeSlug(decodeURIComponent(path.slice('/api/metrics/'.length)))
    if (!slug) return json({ error: 'invalid slug' }, 400)
    return forwardToDo(env, slug, { op: 'get', ip, visitor })
  }

  return json({ error: 'Not found' }, 404)
}

async function forwardToDo(env, slug, payload) {
  const id = env.PRODUCT_METRICS.idFromName(slug)
  const stub = env.PRODUCT_METRICS.get(id)
  return stub.fetch('https://do/metrics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, slug }),
  })
}

export class ProductMetrics {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
  }

  async fetch(request) {
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'bad json' }, 400)
    }

    const slug = normalizeSlug(body.slug)
    if (!slug) return json({ error: 'slug required' }, 400)

    const visitorKey = await resolveVisitorKey(body.visitor, body.ip, slug)
    const day = utcDay()

    return this.ctx.blockConcurrencyWhile(async () => {
      const stats = (await this.ctx.storage.get('stats')) || { v: 0, u: 0 }
      const views = (await this.ctx.storage.get('views')) || {}
      const votes = (await this.ctx.storage.get('votes')) || {}

      if (body.op === 'get') {
        return json({
          ok: true,
          slug,
          site_views: stats.v || 0,
          site_upvotes: stats.u || 0,
          voted: Boolean(votes[visitorKey]),
        })
      }

      if (body.op === 'view') {
        const viewKey = `${day}:${visitorKey}`
        let counted = false
        if (!views[viewKey]) {
          views[viewKey] = 1
          stats.v = (stats.v || 0) + 1
          counted = true
          pruneViews(views, day, 3)
          await this.ctx.storage.put({ stats, views })
          await mirrorKv(this.env, slug, stats)
        }
        return json({
          ok: true,
          slug,
          site_views: stats.v || 0,
          site_upvotes: stats.u || 0,
          counted,
          voted: Boolean(votes[visitorKey]),
        })
      }

      if (body.op === 'upvote') {
        const action = String(body.action || 'toggle').toLowerCase()
        const hasVote = Boolean(votes[visitorKey])
        let voted = hasVote
        let delta = 0

        if (action === 'up') {
          if (!hasVote) {
            votes[visitorKey] = 1
            delta = 1
            voted = true
          }
        } else if (action === 'down') {
          if (hasVote) {
            delete votes[visitorKey]
            delta = -1
            voted = false
          }
        } else if (hasVote) {
          delete votes[visitorKey]
          delta = -1
          voted = false
        } else {
          votes[visitorKey] = 1
          delta = 1
          voted = true
        }

        if (delta) {
          stats.u = Math.max(0, (stats.u || 0) + delta)
          await this.ctx.storage.put({ stats, votes })
          await mirrorKv(this.env, slug, stats)
        }

        return json({
          ok: true,
          slug,
          site_views: stats.v || 0,
          site_upvotes: stats.u || 0,
          voted,
          changed: delta !== 0,
        })
      }

      return json({ error: 'unknown op' }, 400)
    })
  }
}

async function resolveVisitorKey(visitor, ip, slug) {
  if (visitor && VISITOR_RE.test(visitor)) {
    return `vid:${visitor.toLowerCase()}`
  }
  const ipHash = await sha256Hex(`${ip || 'unknown'}|${slug}`)
  return `ip:${ipHash}`
}

function readVisitor(request) {
  const h = (request.headers.get('X-ACH-Visitor') || '').trim()
  return VISITOR_RE.test(h) ? h : ''
}

function pruneViews(views, today, keepDays) {
  const keep = new Set()
  const base = Date.parse(`${today}T00:00:00Z`)
  for (let i = 0; i < keepDays; i++) {
    keep.add(new Date(base - i * 86400000).toISOString().slice(0, 10))
  }
  for (const k of Object.keys(views)) {
    const day = k.slice(0, 10)
    if (!keep.has(day)) delete views[k]
  }
}

async function mirrorKv(env, slug, stats) {
  if (!env?.METRICS) return
  try {
    await env.METRICS.put(`stats:${slug}`, JSON.stringify({ v: stats.v || 0, u: stats.u || 0 }))
  } catch {
    /* optional */
  }
}

function normalizeSlug(s) {
  if (s == null) return null
  const t = String(s).trim()
  if (!t || t.length > 120) return null
  if (!SLUG_RE.test(t)) return null
  return t
}

function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('True-Client-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    ''
  )
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function utcDay() {
  return new Date().toISOString().slice(0, 10)
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
