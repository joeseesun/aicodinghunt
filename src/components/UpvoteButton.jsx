import { useState } from 'react'
import { formatNum } from '../lib/metrics'
import { useSiteMetrics } from '../lib/siteMetrics'

function ChevronUp({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 7.2 5.4 15h13.2L12 7.2Z" />
    </svg>
  )
}

/**
 * PH-style upvote: count + chevron. Optimistic via useSiteMetrics.
 * @param {'card'|'list'|'sticky'|'detail'} variant
 */
export default function UpvoteButton({ slug, variant = 'card', className = '' }) {
  const { get, toggleUpvote } = useSiteMetrics()
  const m = get(slug)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const onClick = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      await toggleUpvote(slug)
    } catch (ex) {
      setErr(ex.message || '失败')
    } finally {
      setBusy(false)
    }
  }

  const voted = Boolean(m.voted)
  const count = m.site_upvotes || 0

  if (variant === 'sticky' || variant === 'detail') {
    return (
      <div className={`flex flex-col items-stretch gap-1 ${className}`}>
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          aria-pressed={voted}
          aria-label={voted ? '取消本站点赞' : '本站点赞'}
          title={voted ? '已点赞 · 再点取消' : '本站点赞（每访客终身一次，可取消）'}
          className={`flex flex-col items-center justify-center min-w-[64px] px-3 py-2.5 rounded-md border transition-[background,border-color,color,transform] duration-200 ease-yarrow active:scale-[0.97] ${
            voted
              ? 'bg-accent text-white border-accent shadow-tile'
              : 'bg-surface text-ink border-line hover:border-accent hover:text-accent hover:bg-accent/5'
          }`}
        >
          <ChevronUp size={16} />
          <strong className="mt-0.5 text-[17px] font-bold tabular-nums leading-none">
            {formatNum(count)}
          </strong>
          <span className={`mt-1 text-[10px] font-semibold tracking-[0.04em] uppercase ${voted ? 'text-white/85' : 'text-ink-4'}`}>
            本站点赞
          </span>
        </button>
        {err ? <span className="text-[11px] text-accent text-center">{err}</span> : null}
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={voted}
        aria-label={voted ? '取消本站点赞' : '本站点赞'}
        title="本站点赞"
        className={`flex flex-col items-center justify-center w-[52px] shrink-0 rounded-md border py-2 transition-[background,border-color,color] duration-200 ease-yarrow ${
          voted
            ? 'bg-accent text-white border-accent'
            : 'bg-chip/60 text-ink border-line-soft hover:border-accent hover:text-accent'
        } ${className}`}
      >
        <ChevronUp size={13} />
        <strong className="text-[14px] font-bold tabular-nums leading-none mt-0.5">{formatNum(count)}</strong>
      </button>
    )
  }

  // card
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={voted}
      aria-label={voted ? '取消本站点赞' : '本站点赞'}
      title="本站点赞"
      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] border text-[13px] font-bold tabular-nums transition-[background,border-color,color] duration-200 ease-yarrow ${
        voted
          ? 'bg-accent text-white border-accent'
          : 'bg-chip text-ink border-line-soft hover:border-accent hover:text-accent'
      } ${className}`}
    >
      <ChevronUp size={12} />
      <span>{formatNum(count)}</span>
    </button>
  )
}
