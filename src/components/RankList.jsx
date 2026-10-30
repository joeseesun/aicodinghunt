import { Link } from 'react-router-dom'
import { CAT_LABELS } from '../lib/categories'
import { formatNum, metric } from '../lib/metrics'
import EmptyState from './EmptyState'

export default function RankList({ products, view }) {
  const key = view === 'likes' ? 'like_count' : 'impression_count'
  const title = view === 'likes' ? '点赞榜' : '浏览榜'

  if (!products.length) {
    return <EmptyState message="没有匹配的工具。" />
  }

  return (
    <section className="pb-16">
      <h2 className="text-[22px] font-bold tracking-[-0.02em] text-ink mb-5">{title}</h2>
      <ul className="flex flex-col gap-2">
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
          return (
            <li key={p.id || p.slug}>
              <Link
                to={href}
                className="flex items-center gap-4 rounded-md bg-surface border border-line-soft px-4 py-3 transition-[background,border-color,transform] duration-200 ease-yarrow hover:bg-chip hover:border-line hover:-translate-y-px"
              >
                <span className="w-8 text-center text-[15px] font-bold tabular-nums text-ink-3">
                  {i + 1}
                </span>
                <img
                  src={p.image || '/images/products/placeholder.svg'}
                  alt=""
                  loading="lazy"
                  className="w-14 h-[42px] rounded-sm object-cover bg-chip shrink-0"
                />
                <span className="flex-1 min-w-0">
                  <strong className="block text-[15.5px] font-bold text-ink truncate">{p.name}</strong>
                  <em className="block text-[13.5px] text-ink-3 not-italic truncate mt-0.5">
                    {CAT_LABELS[p.category] || p.category} ·{' '}
                    {(p.recommenders || []).map((h) => `@${h}`).join(' ') || '社区'}
                  </em>
                </span>
                <span className="text-right shrink-0">
                  <strong className="block text-[17px] font-bold tabular-nums text-ink">{primaryLabel}</strong>
                  <em className="block text-[12.5px] text-ink-3 not-italic">{secondary}</em>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
