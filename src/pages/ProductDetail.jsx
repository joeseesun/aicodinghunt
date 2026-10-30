import { Link, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import ProductCard from '../components/ProductCard'
import { CAT_LABELS } from '../lib/categories'
import { avatarUrl, formatNum, metric } from '../lib/metrics'
import { IconExternal } from '../lib/icons'

function paragraphs(text) {
  if (!text) return []
  return String(text)
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function ProductDetail({ data }) {
  const { slug } = useParams()
  const decoded = decodeURIComponent(slug || '')

  const product = useMemo(() => {
    if (!data?.products) return null
    return data.products.find((p) => p.slug === decoded) || null
  }, [data, decoded])

  const related = useMemo(() => {
    if (!product || !data?.products) return []
    return data.products
      .filter((p) => p.category === product.category && p.slug !== product.slug)
      .slice(0, 4)
  }, [data, product])

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-3">加载中…</div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav query="" onQueryChange={() => {}} />
        <main className="flex-1 shell py-16 text-center">
          <h1 className="text-[28px] font-bold text-ink">未找到该工具</h1>
          <p className="mt-3 text-ink-3">slug：{decoded}</p>
          <Link to="/" className="inline-flex mt-6 h-11 px-5 rounded-pill bg-accent text-white font-semibold hover:bg-accent-hi transition-colors">
            返回猎场
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  const likes = metric(product, 'like_count')
  const imps = metric(product, 'impression_count')
  const rec = (product.recommenders && product.recommenders[0]) || '社区'
  const gallery = [product.image, ...(product.gallery || [])].filter(Boolean)
  const uniqueGallery = [...new Set(gallery)]

  return (
    <div className="min-h-screen flex flex-col">
      <Nav query="" onQueryChange={() => {}} />

      <main className="flex-1">
        <div className="shell pt-8 pb-4 text-[14px] text-ink-3">
          <Link to="/" className="hover:text-accent">
            猎场
          </Link>
          <span className="mx-2">/</span>
          <span>{CAT_LABELS[product.category] || product.category}</span>
          <span className="mx-2">/</span>
          <span className="text-ink-2">{product.name}</span>
        </div>

        <div className="shell pb-16">
          <article className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-10 items-start">
            <div>
              <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-chip shadow-tile after:content-[''] after:absolute after:inset-0 after:rounded-md after:shadow-[inset_0_0_0_1px_rgba(15,18,25,0.07)] after:pointer-events-none">
                <img
                  src={product.image || '/images/products/placeholder.svg'}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              {product.image_note ? (
                <p className="mt-3 text-[13px] text-ink-4">{product.image_note}</p>
              ) : null}
              {uniqueGallery.length > 1 ? (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {uniqueGallery.slice(0, 4).map((src) => (
                    <div key={src} className="aspect-[4/3] rounded-sm overflow-hidden bg-chip border border-line-soft">
                      <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-[5px] bg-chip text-ink-3 text-[11px] font-[750] tracking-[0.07em]">
                  {CAT_LABELS[product.category] || product.category}
                </span>
                <span className="text-[14.5px] font-bold tabular-nums text-ink">
                  {likes != null ? formatNum(likes) : '—'} 赞 · {imps != null ? formatNum(imps) : '—'} 浏览
                </span>
              </div>

              <h1 className="text-[32px] font-[750] tracking-[-0.025em] leading-[1.2] text-ink">
                {product.name}
              </h1>
              <p className="mt-3 text-[16px] text-ink-2 leading-relaxed">{product.summary}</p>

              <div className="flex items-center gap-[9px] mt-5">
                <img
                  src={avatarUrl(rec)}
                  alt=""
                  className="w-8 h-8 rounded-pill border border-line bg-chip"
                />
                <div className="min-w-0">
                  <div className="text-[14.5px] font-semibold text-ink">
                    {(product.recommenders || []).map((h) => `@${h}`).join(' ') || '社区推荐'}
                  </div>
                  <div className="text-[13px] text-ink-3">推荐人</div>
                </div>
              </div>

              {(product.tags || []).length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-5">
                  {product.tags.map((t) => (
                    <span
                      key={t}
                      className="px-[14px] py-[7px] rounded-pill border border-line bg-surface text-[13.5px] text-ink-2"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3 mt-7">
                {product.url ? (
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 h-12 px-6 rounded-pill bg-accent text-white font-semibold transition-[background,transform] duration-200 ease-yarrow hover:bg-accent-hi active:scale-[0.98]"
                  >
                    访问官网 <IconExternal />
                  </a>
                ) : null}
                {product.repo_url ? (
                  <a
                    href={product.repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 h-12 px-6 rounded-pill border border-line bg-surface font-semibold text-ink transition-[background,border-color] duration-200 ease-yarrow hover:bg-chip hover:border-[#c8cedb]"
                  >
                    GitHub
                  </a>
                ) : null}
                {(product.source_reply_urls || [])[0] ? (
                  <a
                    href={product.source_reply_urls[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 h-12 px-6 rounded-pill border border-line bg-surface font-semibold text-ink-2 transition-[background,border-color] duration-200 ease-yarrow hover:bg-chip"
                  >
                    原帖
                  </a>
                ) : null}
              </div>

              <section className="mt-10 pt-8 border-t border-line-soft">
                <h2 className="text-[18px] font-bold text-ink mb-3">详情</h2>
                <div className="space-y-3 text-[15px] text-ink-2 leading-relaxed">
                  {paragraphs(product.detail || product.description || product.summary).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
                {data.updated_at_label ? (
                  <p className="mt-6 text-[13px] text-ink-4">更新 {data.updated_at_label}</p>
                ) : null}
              </section>
            </div>
          </article>

          {related.length > 0 ? (
            <section className="mt-16">
              <h2 className="text-[22px] font-bold tracking-[-0.02em] text-ink mb-6">相关产品</h2>
              <div className="grid grid-cols-1 min-[561px]:grid-cols-2 min-[901px]:grid-cols-4 gap-y-11 gap-x-[22px]">
                {related.map((p) => (
                  <ProductCard key={p.id || p.slug} product={p} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  )
}
