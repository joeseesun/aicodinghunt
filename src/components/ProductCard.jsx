import { Link } from 'react-router-dom'
import { CAT_LABELS } from '../lib/categories'
import { cardSummary, formatNum, isHot, metric } from '../lib/metrics'
import { IconBolt } from '../lib/icons'
import XHandle from './XHandle'

export default function ProductCard({ product: p, catalogAvatars }) {
  const href = `/p/${encodeURIComponent(p.slug)}/`
  const img = p.image || '/images/products/placeholder.svg'
  const rec = (p.recommenders && p.recommenders[0]) || null
  const likes = metric(p, 'like_count')
  const imps = metric(p, 'impression_count')
  const hot = isHot(p)
  const blurb = cardSummary(p, 40)

  return (
    <article className="min-w-0 flex flex-col group">
      <Link to={href} className="block relative">
        <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-chip shadow-tile transition-[transform,box-shadow] duration-[280ms] ease-yarrow group-hover:-translate-y-[3px] group-hover:shadow-tile-hover after:content-[''] after:absolute after:inset-0 after:rounded-md after:shadow-[inset_0_0_0_1px_rgba(15,18,25,0.07)] after:pointer-events-none">
          <img
            src={img}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover block scale-[1.01] transition-transform duration-[420ms] ease-yarrow group-hover:scale-[1.04]"
            onError={(e) => {
              e.currentTarget.src = '/images/products/placeholder.svg'
            }}
          />
        </div>
      </Link>

      <h3 className="mt-[14px] text-[17px] font-bold tracking-[-0.015em] leading-[1.3] text-ink min-w-0">
        <Link to={href} className="hover:text-accent transition-colors duration-200 ease-yarrow">
          {p.name}
        </Link>
      </h3>

      {blurb ? (
        <p className="mt-1.5 text-[13.5px] leading-[1.45] text-ink-3 line-clamp-2 min-h-[2.9em]">
          {blurb}
        </p>
      ) : null}

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

      <div className="flex items-center gap-[7px] mt-3 text-[15px] font-bold text-ink tabular-nums">
        <span title="点赞">{likes != null ? formatNum(likes) : '—'}</span>
        <span className="text-ink-4 font-semibold">赞</span>
        <span className="text-ink-4 font-normal mx-0.5">·</span>
        <span title="浏览">{imps != null ? formatNum(imps) : '—'}</span>
        <span className="text-ink-4 font-semibold">浏览</span>
        {hot ? <IconBolt className="text-bolt" size={14} /> : null}
      </div>
    </article>
  )
}
