import { Link } from 'react-router-dom'
import { CAT_LABELS } from '../lib/categories'
import { cardSummary, formatNum, metric } from '../lib/metrics'
import { useSiteMetrics } from '../lib/siteMetrics'
import EmptyState from './EmptyState'
import UpvoteButton from './UpvoteButton'
import XHandle from './XHandle'

export default function RankList({ products, view, catalogAvatars }) {
  const { get } = useSiteMetrics()
  const isSite = view === 'site'
  const key = view === 'likes' ? 'like_count' : view === 'impressions' ? 'impression_count' : 'site_upvotes'
  const title = view === 'likes' ? '社区点赞榜' : view === 'impressions' ? '社区浏览榜' : '本站点赞榜'

  if (!products.length) {
    return <EmptyState message="没有匹配的工具。" />
  }

  return (
    <section className="pb-16">
      <h2 className="text-[22px] font-bold tracking-[-0.02em] text-ink mb-2">{title}</h2>
      <p className="text-[13.5px] text-ink-3 mb-5">
        {isSite
          ? '按本站点赞排序 · 每访客对每个产品终身一票（可取消）'
          : '按 X 原帖 public_metrics 排序 · 与本站点赞分开统计'}
      </p>
      <ul className="flex flex-col gap-2.5">
        {products.map((p, i) => {
          const likes = metric(p, 'like_count')
          const imps = metric(p, 'impression_count')
          const site = get(p.slug)
          let primaryLabel
          let secondary
          if (isSite) {
            primaryLabel = formatNum(site.site_upvotes || 0)
            secondary = `本站浏览 ${formatNum(site.site_views || 0)} · 社区赞 ${likes != null ? likes : '—'}`
          } else if (key === 'like_count') {
            primaryLabel = likes == null ? '—' : String(likes)
            secondary =
              imps == null ? `本站点赞 ${site.site_upvotes || 0}` : `浏览 ${formatNum(imps)} · 本站 ${site.site_upvotes || 0}`
          } else {
            primaryLabel = imps == null ? '—' : formatNum(imps)
            secondary =
              likes == null ? `本站点赞 ${site.site_upvotes || 0}` : `赞 ${likes} · 本站 ${site.site_upvotes || 0}`
          }
          const href = `/p/${encodeURIComponent(p.slug)}/`
          const rec = (p.recommenders && p.recommenders[0]) || null
          const blurb = cardSummary(p, 56)
          return (
            <li key={p.id || p.slug}>
              <div className="flex items-center gap-3 sm:gap-4 rounded-md bg-surface border border-line-soft px-3 sm:px-4 py-3.5 transition-[background,border-color,transform,box-shadow] duration-200 ease-yarrow hover:bg-chip hover:border-line hover:-translate-y-px hover:shadow-tile">
                <span className="w-7 text-center text-[15px] font-bold tabular-nums text-ink-3 shrink-0">
                  {i + 1}
                </span>
                <UpvoteButton slug={p.slug} variant="list" />
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
                <span className="text-right shrink-0 pl-2 hidden sm:block">
                  <strong className="block text-[17px] font-bold tabular-nums text-ink">
                    {primaryLabel}
                  </strong>
                  <em className="block text-[12px] text-ink-3 not-italic max-w-[11rem]">{secondary}</em>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
