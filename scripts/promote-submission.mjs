#!/usr/bin/env node
/**
 * Promote an approved GitHub submission issue into data/products.json
 * Usage:
 *   node scripts/promote-submission.mjs --issue 12
 *   node scripts/promote-submission.mjs --dry-run --issue 12
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const dry = args.includes('--dry-run')
const issueIdx = args.indexOf('--issue')
const issueNum = issueIdx >= 0 ? args[issueIdx + 1] : null
if (!issueNum) {
  console.error('Usage: node scripts/promote-submission.mjs --issue <n> [--dry-run]')
  process.exit(1)
}

const raw = execFileSync(
  'gh',
  ['issue', 'view', String(issueNum), '-R', 'joeseesun/aicodinghunt', '--json', 'body,title,labels,url'],
  { encoding: 'utf8' },
)
const issue = JSON.parse(raw)
const m = issue.body.match(/<!-- ach-submission\n([\s\S]*?)\n-->/)
if (!m) {
  console.error('No ach-submission payload in issue body')
  process.exit(1)
}
const rec = JSON.parse(m[1])
const dataPath = join(root, 'data', 'products.json')
const catalog = JSON.parse(readFileSync(dataPath, 'utf8'))

const slugBase = slugify(rec.name || rec.preview?.title || `submission-${rec.id}`)
let slug = slugBase
let n = 2
const used = new Set(catalog.products.map((p) => p.slug))
while (used.has(slug)) {
  slug = `${slugBase}-${n++}`
}

const product = {
  id: rec.id || `sub-${issueNum}`,
  name: rec.name || rec.preview?.title || `Submission ${issueNum}`,
  slug,
  summary: rec.description || rec.preview?.description || '',
  detail: rec.notes || rec.description || '',
  category: rec.category || 'other',
  url: rec.url,
  repo_url: (rec.url || '').includes('github.com') ? rec.url : null,
  recommenders: rec.x_handle ? [rec.x_handle] : [],
  source_reply_urls: [],
  replies: [],
  image: rec.preview?.image || null,
  like_count: null,
  impression_count: null,
  submission_issue: issue.url,
}

if (dry) {
  console.log(JSON.stringify(product, null, 2))
  process.exit(0)
}

catalog.products.unshift(product)
catalog.product_count = catalog.products.length
catalog.updated_at = new Date().toISOString()
catalog.updated_at_label = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) + ' Asia/Shanghai'
const cats = {}
for (const p of catalog.products) cats[p.category] = (cats[p.category] || 0) + 1
catalog.categories = cats
writeFileSync(dataPath, JSON.stringify(catalog, null, 2) + '\n')
writeFileSync(join(root, 'public', 'data', 'products.json'), JSON.stringify(catalog, null, 2) + '\n')
console.log('promoted', product.name, '→', product.slug)
console.log('Remember: npm run build && wrangler deploy')

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'product'
}
