import { Link, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import ProductCard from '../components/ProductCard'
import SeoHead, { SITE } from '../components/SeoHead'
import { XHandleList } from '../components/XHandle'
import { CAT_LABELS } from '../lib/categories'
import { formatNum, metric } from '../lib/metrics'
import { IconExternal } from '../lib/icons'

function paragraphs(text) {
  if (!text) return []
  return String(text)
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function Section({ title, children, className = '' }) {
  if (!children) return null
  return (
    <section className={`pt-7 mt-7 border-t border-line-soft ${className}`}>
      <h2 className="text-[15px] font-[750] tracking-[0.04em] uppercase text-ink-3 mb-3">{title}</h2>
      <div className="text-[15px] text-ink-2 leading-relaxed">{children}</div>
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-md bg-chip/80 border border-line-soft px-4 py-3 min-w-[7.5rem]">
      <div className="text-[12px] font-semibold tracking-[0.06em] text-ink-4 uppercase">{label}</div>
      <div className="mt-1 text-[18px] font-bold tabular-nums text-ink">{value}</div>
    </div>
  )
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
      .sort(
        (a, b) =>
          (metric(b, 'like_count') || 0) - (metric(a, 'like_count') || 0) ||
          (metric(b, 'impression_count') || 0) - (metric(a, 'impression_count') || 0),
      )
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
        <SeoHead title="未找到该工具" description="该产品不在 AI Coding Hunt 猎场中。" path={`/p/${encodeURIComponent(decoded)}/`} />
        <Nav query="" onQueryChange={() => {}} />
        <main className="flex-1 shell py-16 text-center">
          <h1 className="text-[28px] font-bold text-ink">未找到该工具</h1>
          <p className="mt-3 text-ink-3">slug：{decoded}</p>
          <Link
            to="/"
            className="inline-flex mt-6 h-11 px-5 rounded-pill bg-accent text-white font-semibold hover:bg-accent-hi transition-colors"
          >
            返回猎场
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  const likes = metric(product, 'like_count')
  const imps = metric(product, 'impression_count')
  const bookmarks = metric(product, 'bookmark_count')
  const gallery = [product.image, ...(product.gallery || [])].filter(Boolean)
  const uniqueGallery = [...new Set(gallery)]
  const caps = product.capabilities || []
  const detailParas = paragraphs(product.detail || product.description || product.summary)
  const path = `/p/${encodeURIComponent(product.slug)}/`
  const desc =
    product.summary ||
    `${product.name} — ${CAT_LABELS[product.category] || product.category} · 乔木 AI 工具猎场收录`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: product.name,
    description: desc,
    applicationCategory: CAT_LABELS[product.category] || product.category,
    url: product.url || `${SITE}${path}`,
    image: product.image ? `${SITE}${product.image}` : undefined,
    offers: product.pricing
      ? {
          '@type': 'Offer',
          price: product.pricing.includes('免费') || product.pricing.includes('开源') ? '0' : undefined,
          description: product.pricing,
          priceCurrency: 'CNY',
        }
      : undefined,
    author: (product.recommenders || []).map((h) => ({
      '@type': 'Person',
      name: `@${h}`,
      url: `https://x.com/${h}`,
    })),
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SeoHead
        title={product.name}
        description={desc}
        path={path}
        image={product.image}
        type="article"
        jsonLd={jsonLd}
      />
      <Nav query="" onQueryChange={() => {}} />

      <main className="flex-1">
        <div className="shell pt-8 pb-4 text-[14px] text-ink-3">
          <Link to="/" className="hover:text-accent transition-colors">
            猎场
          </Link>
          <span className="mx-2 text-ink-4">/</span>
          <span>{CAT_LABELS[product.category] || product.category}</span>
          <span className="mx-2 text-ink-4">/</span>
          <span className="text-ink-2">{product.name}</span>
        </div>

        <div className="shell pb-16">
          <article className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-10 lg:gap-12 items-start">
            <div className="lg:sticky lg:top-6">
              <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-chip shadow-tile after:content-[''] after:absolute after:inset-0 after:rounded-md after:shadow-[inset_0_0_0_1px_rgba(15,18,25,0.07)] after:pointer-events-none">
                <img
                  src={product.image || '/images/products/placeholder.svg'}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              {uniqueGallery.length > 1 ? (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {uniqueGallery.slice(0, 4).map((src) => (
                    <div
                      key={src}
                      className="aspect-[4/3] rounded-sm overflow-hidden bg-chip border border-line-soft"
                    >
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
                {product.pricing ? (
                  <span className="px-2.5 py-1 rounded-[5px] bg-accent/10 text-accent text-[11px] font-[750] tracking-[0.04em]">
                    {product.pricing}
                  </span>
                ) : null}
              </div>

              <h1 className="text-[30px] sm:text-[34px] font-[750] tracking-[-0.025em] leading-[1.18] text-ink">
                {product.name}
              </h1>
              <p className="mt-3 text-[16.5px] text-ink-2 leading-relaxed">{product.summary}</p>

              <div className="mt-6">
                <div className="text-[12.5px] font-semibold tracking-[0.06em] uppercase text-ink-4 mb-2">
                  推荐人
                </div>
                <XHandleList
                  handles={product.recommenders}
                  product={product}
                  catalogAvatars={data.avatars}
                  size={32}
                />
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
                    GitHub{product.stars != null ? ` · ★ ${formatNum(product.stars)}` : ''}
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

              <Section title="这是什么">
                <div className="space-y-3">
                  {detailParas.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </Section>

              {product.who_for ? (
                <Section title="适合谁">
                  <p>{product.who_for}</p>
                </Section>
              ) : null}

              {caps.length > 0 ? (
                <Section title="关键能力">
                  <ul className="space-y-2.5">
                    {caps.map((c) => (
                      <li key={c} className="flex gap-2.5">
                        <span className="mt-[7px] w-1.5 h-1.5 rounded-pill bg-accent shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              <Section title="价格或开源">
                <p>
                  {product.pricing ||
                    (product.repo_url ? '开源仓库可见，具体许可请查看 GitHub' : '未标注，请见官网或原帖')}
                </p>
              </Section>

              <Section title="数据">
                <div className="flex flex-wrap gap-2.5">
                  <Stat label="点赞" value={likes != null ? formatNum(likes) : '—'} />
                  <Stat label="浏览" value={imps != null ? formatNum(imps) : '—'} />
                  <Stat label="收藏" value={bookmarks != null ? formatNum(bookmarks) : '—'} />
                  {product.stars != null ? (
                    <Stat label="GitHub ★" value={formatNum(product.stars)} />
                  ) : null}
                  <Stat
                    label="收录"
                    value={product.listed_at_day || product.listed_at_label || data.updated_at_label || '—'}
                  />
                </div>
                {product.listed_at_label ? (
                  <p className="mt-3 text-[13px] text-ink-4">首次出现于社区帖 · {product.listed_at_label}</p>
                ) : null}
              </Section>

              <Section title="原帖与官网">
                <ul className="space-y-2">
                  {product.url ? (
                    <li>
                      <a
                        className="text-accent hover:text-accent-hi font-medium break-all"
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        官网 · {product.url}
                      </a>
                    </li>
                  ) : null}
                  {product.repo_url ? (
                    <li>
                      <a
                        className="text-accent hover:text-accent-hi font-medium break-all"
                        href={product.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        GitHub · {product.repo_url}
                      </a>
                    </li>
                  ) : null}
                  {(product.source_reply_urls || []).map((u, i) => (
                    <li key={u}>
                      <a
                        className="text-ink-2 hover:text-accent font-medium break-all"
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {i === 0 ? '原帖' : `原帖 ${i + 1}`} · {u}
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          </article>

          {related.length > 0 ? (
            <section className="mt-16 pt-2">
              <h2 className="text-[22px] font-bold tracking-[-0.02em] text-ink mb-2">相关产品</h2>
              <p className="text-[14.5px] text-ink-3 mb-6">
                同属「{CAT_LABELS[product.category] || product.category}」的其他猎场收录
              </p>
              <div className="grid grid-cols-1 min-[561px]:grid-cols-2 min-[901px]:grid-cols-4 gap-y-11 gap-x-[22px]">
                {related.map((p) => (
                  <ProductCard key={p.id || p.slug} product={p} catalogAvatars={data.avatars} />
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
