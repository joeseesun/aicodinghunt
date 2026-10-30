import { Link } from 'react-router-dom'
import { CAT_LABELS } from '../lib/categories'
import { cardSummary, formatNum, isHot, metric } from '../lib/metrics'
import { IconBolt } from '../lib/icons'
import { useSiteMetrics } from '../lib/siteMetrics'
import UpvoteButton from './UpvoteButton'
import XHandle from './XHandle'

export default function ProductCard({ product: p, catalogAvatars }) {
  const href = `/p/${encodeURIComponent(p.slug)}/`
  const img = p.image || '/images/products/placeholder.svg'
  const rec = (p.recommenders && p.recommenders[0]) || null
  const likes = metric(p, 'like_count')
  const imps = metric(p, 'impression_count')
  const hot = isHot(p)
  const blurb = cardSummary(p, 48)
  const { get } = useSiteMetrics()
  const site = get(p.slug)

  return (
    <article className="min-w-0 flex flex-col group">
      <Link to={href} className="block relative">
        <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-chip border border-line-soft transition-[border-color] duration-200 ease-yarrow group-hover:border-line after:content-[''] after:absolute after:inset-0 after:rounded-md after:shadow-[inset_0_0_0_1px_rgba(15,18,25,0.04)] after:pointer-events-none">
          <img
            src={img}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover block"
            onError={(e) => {
              e.currentTarget.src = '/images/products/placeholder.svg'
            }}
          />
        </div>
      </Link>

      <div className="mt-[14px] flex items-start gap-2.5 min-w-0">
        <UpvoteButton slug={p.slug} variant="card" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-bold tracking-[-0.015em] leading-[1.3] text-ink min-w-0">
            <Link to={href} className="hover:text-accent transition-colors duration-200 ease-yarrow">
              {p.name}
            </Link>
          </h3>
          {blurb ? (
            <p className="mt-1.5 text-[13.5px] leading-[1.45] text-ink-3 line-clamp-2 min-h-[2.9em]">
              {blurb}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-[9px] mt-2.5 min-w-0">
        {rec ? (
          <XHandle handle={rec} product={p} catalogAvatars={catalogAvatars} size={24} />
        ) : (
          <span className="text-sm text-ink-3">社区</span>
        )}
        <span className="shrink-0 px-2 py-0.5 rounded-[5px] bg-chip text-ink-3 text-[11px] font-[750] tracking-[0.07em]">
          {CAT_LABELS[p.category] || p.category}
        </span>
      </div>

      <div className="flex items-center flex-wrap gap-x-[7px] gap-y-1 mt-3 text-[12.5px] font-semibold text-ink-3 tabular-nums">
        <span title="本站浏览" className="inline-flex items-center gap-1">
          <span className="text-ink font-bold">{formatNum(site.site_views || 0)}</span>
          <span className="text-ink-4 font-semibold">本站浏览</span>
        </span>
        <span className="text-ink-4 font-normal">·</span>
        <span title="社区点赞（X）" className="inline-flex items-center gap-1">
          <span className="text-ink font-bold">{likes != null ? formatNum(likes) : '—'}</span>
          <span className="text-ink-4 font-semibold">社区点赞</span>
        </span>
        <span className="text-ink-4 font-normal">·</span>
        <span title="社区浏览（X）" className="inline-flex items-center gap-1">
          <span className="text-ink font-bold">{imps != null ? formatNum(imps) : '—'}</span>
          <span className="text-ink-4 font-semibold">社区浏览</span>
        </span>
        {hot ? <IconBolt className="text-bolt" size={14} /> : null}
      </div>
    </article>
  )
}
