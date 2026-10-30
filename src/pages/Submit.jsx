import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import SeoHead from '../components/SeoHead'
import { CAT_LABELS, CAT_ORDER } from '../lib/categories'

const EMPTY = {
  url: '',
  description: '',
  name: '',
  category: '',
  x_handle: '',
  notes: '',
}

export default function Submit() {
  const [form, setForm] = useState(EMPTY)
  const [imageFile, setImageFile] = useState(null)
  const [extraFiles, setExtraFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const canSubmit = useMemo(() => {
    return form.url.trim().length > 8 && form.description.trim().length >= 4 && !busy
  }, [form, busy])

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setResult(null)
    if (!canSubmit) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('url', form.url.trim())
      fd.set('description', form.description.trim())
      if (form.name.trim()) fd.set('name', form.name.trim())
      if (form.category) fd.set('category', form.category)
      if (form.x_handle.trim()) fd.set('x_handle', form.x_handle.trim().replace(/^@/, ''))
      if (form.notes.trim()) fd.set('notes', form.notes.trim())
      if (imageFile) fd.set('image', imageFile)
      for (const f of extraFiles) fd.append('files', f)

      const res = await fetch('/api/submit', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `提交失败（HTTP ${res.status}）`)
      }
      setResult(data)
      setForm(EMPTY)
      setImageFile(null)
      setExtraFiles([])
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SeoHead
        title="投稿"
        description="向 AI Coding Hunt 投稿你的 AI Coding 工具：填写产品链接与简短描述，我们将自动抓取标题与封面。"
        path="/submit"
      />
      <Nav query="" onQueryChange={() => {}} showSearch={false} />

      <main className="flex-1">
        <div className="shell pt-10 sm:pt-14 pb-16 max-w-[760px]">
          <p className="text-[13px] font-semibold tracking-[0.04em] uppercase text-accent">Submit</p>
          <h1 className="mt-2 text-[32px] sm:text-[38px] font-[750] tracking-[-0.03em] text-ink">
            投稿你的工具
          </h1>
          <p className="mt-3 text-[15.5px] text-ink-3 leading-relaxed max-w-[58ch]">
            只需产品链接 + 一段中文描述。我们会自动抓取标题、摘要与封面图；也可选上传图片和其他资料。审核通过后会出现在猎场。
          </p>

          {result ? (
            <div className="mt-8 rounded-md border border-line-soft bg-surface p-6">
              <p className="text-[15px] font-bold text-live">感谢投稿！</p>
              <p className="mt-2 text-[14.5px] text-ink-3">
                已收到你的提交
                {result.issue_url ? (
                  <>
                    ，跟踪：{' '}
                    <a className="text-accent font-semibold hover:underline" href={result.issue_url} target="_blank" rel="noopener noreferrer">
                      GitHub Issue #{result.issue_number}
                    </a>
                  </>
                ) : null}
                。我们会尽快审核。
              </p>
              {result.preview ? (
                <div className="mt-5 flex gap-4 items-start rounded-md border border-line-soft bg-canvas p-4">
                  {result.preview.image ? (
                    <img
                      src={result.preview.image}
                      alt=""
                      className="w-28 h-21 object-cover rounded-sm border border-line-soft bg-chip shrink-0"
                      style={{ height: 84 }}
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-ink truncate">{result.preview.title || '（未抓到标题）'}</div>
                    <p className="mt-1 text-[13.5px] text-ink-3 line-clamp-3">{result.preview.description}</p>
                    <a
                      className="mt-2 inline-block text-[13px] text-accent font-semibold truncate max-w-full"
                      href={result.preview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {result.preview.url}
                    </a>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                className="mt-5 h-11 px-5 rounded-pill bg-ink text-surface font-semibold"
                onClick={() => setResult(null)}
              >
                再投一个
              </button>
              <Link to="/" className="ml-3 inline-flex h-11 px-5 items-center rounded-pill border border-line font-semibold text-ink-2 hover:bg-chip">
                回猎场
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <Field label="产品链接" required hint="官网 / GitHub / 文档页（不支持微信链接）">
                <input
                  type="url"
                  required
                  value={form.url}
                  onChange={(e) => setField('url', e.target.value)}
                  placeholder="https://"
                  className="field-input"
                />
              </Field>

              <Field label="简短中文描述" required hint="一句话说清它是什么、解决什么问题">
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="例如：轻量 Raycast 替代，支持本地扩展…"
                  className="field-input resize-y min-h-[96px]"
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="产品名称" hint="可选，不填则用抓取标题">
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="TinyCast"
                    className="field-input"
                  />
                </Field>
                <Field label="分类" hint="可选">
                  <select
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value)}
                    className="field-input"
                  >
                    <option value="">自动 / 其他</option>
                    {CAT_ORDER.map((c) => (
                      <option key={c} value={c}>
                        {CAT_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="你的 X 账号" hint="可选，便于署名推荐人">
                <input
                  type="text"
                  value={form.x_handle}
                  onChange={(e) => setField('x_handle', e.target.value)}
                  placeholder="@handle"
                  className="field-input"
                />
              </Field>

              <Field label="封面图片" hint="可选，JPG/PNG/WebP，≤4MB">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="block w-full text-[14px] text-ink-2 file:mr-3 file:h-10 file:px-4 file:rounded-pill file:border-0 file:bg-chip file:font-semibold file:text-ink hover:file:bg-chip-hover"
                />
              </Field>

              <Field label="补充说明 / 附件" hint="可选，可多选文档或更多截图">
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="仓库地址、演示视频、补充卖点…"
                  className="field-input resize-y"
                />
                <input
                  type="file"
                  multiple
                  className="mt-3 block w-full text-[14px] text-ink-2 file:mr-3 file:h-10 file:px-4 file:rounded-pill file:border-0 file:bg-chip file:font-semibold file:text-ink"
                  onChange={(e) => setExtraFiles(Array.from(e.target.files || []))}
                />
              </Field>

              {error ? (
                <p className="text-[14.5px] text-accent font-semibold" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="h-12 px-6 rounded-pill bg-accent text-white font-semibold disabled:opacity-50 hover:bg-accent-hi transition-colors"
                >
                  {busy ? '提交中…' : '提交投稿'}
                </button>
                <p className="text-[13px] text-ink-4">提交即表示内容可公开收录到本站与开源仓库。</p>
              </div>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function Field({ label, required, hint, children }) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-2">
        <span className="text-[14px] font-bold text-ink">
          {label}
          {required ? <span className="text-accent"> *</span> : null}
        </span>
        {hint ? <span className="text-[12.5px] text-ink-4">{hint}</span> : null}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  )
}
