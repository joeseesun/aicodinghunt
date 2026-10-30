import { Link } from 'react-router-dom'
import { CAT_LABELS } from '../lib/categories'
import { cardSummary, formatNum, metric } from '../lib/metrics'
import EmptyState from './EmptyState'
import XHandle from './XHandle'

export default function RankList({ products, view, catalogAvatars }) {
  const key = view === 'likes' ? 'like_count' : 'impression_count'
  const title = view === 'likes' ? '点赞榜' : '浏览榜'

  if (!products.length) {
    return <EmptyState message="没有匹配的工具。" />
  }

  return (
    <section className="pb-16">
      <h2 className="text-[22px] font-bold tracking-[-0.02em] text-ink mb-5">{title}</h2>
      <ul className="flex flex-col gap-2.5">
        {products.map((p, i) => {
          const likes = metric(p, 'like_count')
          const imps = metric(p, 'impression_count')
          const primary = key === 'like_count' ? likes : imps
          const primaryLabel =
            primary == null
              ? '—'
              : key === 'impression_count'
                ? formatNum(primary)
                : String(primary)
          const secondary =
            key === 'like_count'
              ? imps == null
                ? '浏览 —'
                : `浏览 ${formatNum(imps)}`
              : likes == null
                ? '赞 —'
                : `赞 ${likes}`
          const href = `/p/${encodeURIComponent(p.slug)}/`
          const rec = (p.recommenders && p.recommenders[0]) || null
          const blurb = cardSummary(p, 40)
          return (
            <li key={p.id || p.slug}>
              <div className="flex items-center gap-4 rounded-md bg-surface border border-line-soft px-4 py-3.5 transition-[background,border-color,transform,box-shadow] duration-200 ease-yarrow hover:bg-chip hover:border-line hover:-translate-y-px hover:shadow-tile">
                <span className="w-8 text-center text-[15px] font-bold tabular-nums text-ink-3">
                  {i + 1}
                </span>
                <Link to={href} className="shrink-0">
                  <img
                    src={p.image || '/images/products/placeholder.svg'}
                    alt=""
                    loading="lazy"
                    className="w-[72px] h-[54px] rounded-sm object-cover bg-chip border border-line-soft"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={href} className="block">
                    <strong className="block text-[15.5px] font-bold text-ink truncate hover:text-accent transition-colors">
                      {p.name}
                    </strong>
                  </Link>
                  {blurb ? (
                    <p className="mt-0.5 text-[13px] text-ink-3 truncate">{blurb}</p>
                  ) : null}
                  <div className="mt-1.5 flex items-center gap-2 min-w-0">
                    <span className="text-[12.5px] text-ink-4 shrink-0">
                      {CAT_LABELS[p.category] || p.category}
                    </span>
                    <span className="text-ink-4">·</span>
                    {rec ? (
                      <XHandle
                        handle={rec}
                        product={p}
                        catalogAvatars={catalogAvatars}
                        size={18}
                        className="text-[12.5px]"
                      />
                    ) : (
                      <span className="text-[12.5px] text-ink-3">社区</span>
                    )}
                  </div>
                </div>
                <span className="text-right shrink-0 pl-2">
                  <strong className="block text-[17px] font-bold tabular-nums text-ink">
                    {primaryLabel}
                  </strong>
                  <em className="block text-[12.5px] text-ink-3 not-italic">{secondary}</em>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
