import { handleMetricsApi, ProductMetrics } from './metrics.js'
export { ProductMetrics }
/**
 * AI Coding Hunt Worker — assets + submit + site metrics (view/upvote)
 */
const REPO = 'joeseesun/aicodinghunt'
const MAX_IMAGE = 4 * 1024 * 1024
const MAX_EXTRA = 6 * 1024 * 1024
const FETCH_TIMEOUT_MS = 8000

const WECHAT_HOSTS = [
  'mp.weixin.qq.com',
  'weixin.qq.com',
  'wx.qq.com',
]

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    const path = url.pathname.replace(/\/$/, '') || url.pathname
    if (
      path === '/api/view' ||
      path === '/api/upvote' ||
      path === '/api/metrics' ||
      path.startsWith('/api/metrics/')
    ) {
      try {
        return cors(await handleMetricsApi(request, env, url))
      } catch (err) {
        return cors(json({ error: err.message || String(err) }, 500))
      }
    }

    if (url.pathname === '/api/submit' || path === '/api/submit') {
      if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }))
      if (request.method !== 'POST') {
        return cors(json({ error: 'Method not allowed' }, 405))
      }
      try {
        return cors(await handleSubmit(request, env))
      } catch (err) {
        return cors(json({ error: err.message || String(err) }, 500))
      }
    }

    if (url.pathname.startsWith('/api/submission-assets/')) {
      return serveSubmissionAsset(url, env)
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }
    return new Response('Not found', { status: 404 })
  },
}

function cors(res) {
  const headers = new Headers(res.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return new Response(res.body, { status: res.status, headers })
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

async function handleSubmit(request, env) {
  const ctype = request.headers.get('content-type') || ''
  let fields = {}
  let image = null
  let extras = []

  if (ctype.includes('multipart/form-data')) {
    const form = await request.formData()
    for (const [k, v] of form.entries()) {
      if (v instanceof File) {
        if (k === 'image') image = v
        else if (k === 'files') extras.push(v)
      } else {
        fields[k] = String(v)
      }
    }
  } else {
    fields = await request.json()
  }

  const productUrl = (fields.url || '').trim()
  const description = (fields.description || '').trim()
  const name = (fields.name || '').trim()
  const category = (fields.category || '').trim()
  const xHandle = (fields.x_handle || fields.xHandle || '').trim().replace(/^@/, '')
  const notes = (fields.notes || '').trim()

  if (!productUrl || !/^https?:\/\//i.test(productUrl)) {
    return json({ error: '请填写有效的 http(s) 产品链接' }, 400)
  }
  if (description.length < 4) {
    return json({ error: '请填写至少 4 个字的中文描述' }, 400)
  }

  let parsed
  try {
    parsed = new URL(productUrl)
  } catch {
    return json({ error: '链接格式无效' }, 400)
  }
  if (WECHAT_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
    return json({ error: '暂不支持微信公众号 / 微信链接，请改用官网或 GitHub' }, 400)
  }

  const preview = await fetchPreview(productUrl)
  const id = crypto.randomUUID().slice(0, 8)
  const submittedAt = new Date().toISOString()

  const record = {
    id,
    submitted_at: submittedAt,
    url: productUrl,
    description,
    name: name || preview.title || '',
    category: category || 'other',
    x_handle: xHandle || null,
    notes: notes || null,
    preview,
  }

  const assetUrls = []
  if (env.SUBMISSIONS && image && image.size > 0) {
    if (image.size > MAX_IMAGE) return json({ error: '封面图片请不超过 4MB' }, 400)
    const ext = extFromFile(image) || 'jpg'
    const key = `inbox/${id}/cover.${ext}`
    await env.SUBMISSIONS.put(key, await image.arrayBuffer(), {
      httpMetadata: { contentType: image.type || 'application/octet-stream' },
    })
    assetUrls.push(`/api/submission-assets/${key}`)
    record.cover_key = key
  }

  if (env.SUBMISSIONS && extras.length) {
    record.extra_keys = []
    let i = 0
    for (const f of extras.slice(0, 5)) {
      if (!f || !f.size) continue
      if (f.size > MAX_EXTRA) continue
      i += 1
      const ext = extFromFile(f) || 'bin'
      const key = `inbox/${id}/extra-${i}.${ext}`
      await env.SUBMISSIONS.put(key, await f.arrayBuffer(), {
        httpMetadata: { contentType: f.type || 'application/octet-stream' },
      })
      record.extra_keys.push(key)
      assetUrls.push(`/api/submission-assets/${key}`)
    }
  }

  if (env.SUBMISSIONS) {
    await env.SUBMISSIONS.put(`inbox/${id}/meta.json`, JSON.stringify(record, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    })
  }

  let issue = null
  if (env.GITHUB_TOKEN) {
    issue = await createGithubIssue(env.GITHUB_TOKEN, record, assetUrls, request)
  }

  return json({
    ok: true,
    id,
    preview: {
      title: record.name || preview.title,
      description: preview.description || description,
      image: preview.image || (assetUrls[0] ? new URL(assetUrls[0], request.url).href : null),
      url: productUrl,
    },
    issue_url: issue?.html_url || null,
    issue_number: issue?.number || null,
    stored: Boolean(env.SUBMISSIONS),
  })
}

async function fetchPreview(targetUrl) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(targetUrl, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; AICodingHuntBot/1.0; +https://aicodinghunt.qiaomu.ai)',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    const ctype = res.headers.get('content-type') || ''
    if (!res.ok || !ctype.includes('text/html')) {
      return { title: null, description: null, image: null, final_url: res.url }
    }
    const html = await res.text()
    const sliced = html.slice(0, 250000)
    return {
      title: meta(sliced, 'og:title') || meta(sliced, 'twitter:title') || titleTag(sliced),
      description:
        meta(sliced, 'og:description') ||
        meta(sliced, 'description') ||
        meta(sliced, 'twitter:description'),
      image: absUrl(meta(sliced, 'og:image') || meta(sliced, 'twitter:image'), res.url),
      final_url: res.url,
    }
  } catch {
    return { title: null, description: null, image: null, final_url: targetUrl }
  } finally {
    clearTimeout(timer)
  }
}

function meta(html, key) {
  const prop = key.startsWith('og:') || key.startsWith('twitter:') ? 'property' : 'name'
  const re1 = new RegExp(
    `<meta[^>]+(?:${prop}|name)=["']${escapeRe(key)}["'][^>]+content=["']([^"']+)["']`,
    'i',
  )
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:${prop}|name)=["']${escapeRe(key)}["']`,
    'i',
  )
  const m = html.match(re1) || html.match(re2)
  return m ? decodeHtml(m[1].trim()) : null
}

function titleTag(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m ? decodeHtml(m[1].trim()) : null
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function absUrl(maybe, base) {
  if (!maybe) return null
  try {
    return new URL(maybe, base).href
  } catch {
    return maybe
  }
}

function extFromFile(file) {
  const n = (file.name || '').toLowerCase()
  const m = n.match(/\.([a-z0-9]+)$/)
  if (m) return m[1].slice(0, 8)
  const t = (file.type || '').toLowerCase()
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('gif')) return 'gif'
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg'
  if (t.includes('pdf')) return 'pdf'
  return null
}

async function createGithubIssue(token, record, assetUrls, request) {
  const titleName = record.name || record.preview?.title || '未命名产品'
  const title = `[投稿] ${titleName}`
  const site = new URL(request.url).origin
  const absAssets = assetUrls.map((u) => (u.startsWith('http') ? u : `${site}${u}`))

  const body = [
    '## 投稿信息',
    '',
    `- **URL**: ${record.url}`,
    `- **名称**: ${titleName}`,
    `- **分类**: ${record.category}`,
    `- **描述**: ${record.description}`,
    record.x_handle ? `- **投稿人 X**: @${record.x_handle}` : null,
    record.notes ? `- **备注**: ${record.notes}` : null,
    `- **提交时间**: ${record.submitted_at}`,
    `- **内部 ID**: \`${record.id}\``,
    '',
    '## 自动抓取 Preview',
    '',
    '```json',
    JSON.stringify(record.preview || {}, null, 2),
    '```',
    '',
    absAssets.length ? '## 附件' : null,
    ...absAssets.map((u, i) => `- [asset ${i + 1}](${u})`),
    absAssets[0] ? `\n![cover](${absAssets[0]})` : null,
    '',
    '---',
    '',
    '<!-- ach-submission',
    JSON.stringify(record),
    '-->',
    '',
    '审核通过后可用：`node scripts/promote-submission.mjs --issue <n>`',
  ]
    .filter((x) => x != null)
    .join('\n')

  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'aicodinghunt-worker',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({
      title,
      body,
      labels: ['submission'],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub Issue 创建失败：${res.status} ${text.slice(0, 200)}`)
  }
  return res.json()
}

async function serveSubmissionAsset(url, env) {
  if (!env.SUBMISSIONS) return new Response('R2 unavailable', { status: 503 })
  const key = decodeURIComponent(url.pathname.replace('/api/submission-assets/', ''))
  if (!key || key.includes('..')) return new Response('Bad key', { status: 400 })
  const obj = await env.SUBMISSIONS.get(key)
  if (!obj) return new Response('Not found', { status: 404 })
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('cache-control', 'public, max-age=86400')
  return new Response(obj.body, { headers })
}
