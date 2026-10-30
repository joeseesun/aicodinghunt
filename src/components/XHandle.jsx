import { avatarUrl, xProfileUrl } from '../lib/metrics'

/**
 * Clickable X author/recommender: real avatar + @handle → https://x.com/{handle}
 */
export default function XHandle({
  handle,
  product,
  catalogAvatars,
  size = 24,
  showName = true,
  className = '',
}) {
  const key = String(handle || '').replace(/^@/, '') || 'community'
  const href = xProfileUrl(key)
  const src = avatarUrl(key, product, catalogAvatars)

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-[9px] min-w-0 max-w-full rounded-pill transition-[color,transform,opacity] duration-200 ease-yarrow hover:text-accent hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      title={`在 X 上关注 @${key}`}
      aria-label={`在 X 上打开 @${key}`}
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0 rounded-pill object-cover bg-chip border border-line block"
        style={{ width: size, height: size }}
        onError={(e) => {
          e.currentTarget.src = '/images/avatars/_placeholder.svg'
        }}
      />
      {showName ? (
        <span className="text-sm text-ink-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          @{key}
        </span>
      ) : null}
    </a>
  )
}

export function XHandleList({ handles, product, catalogAvatars, size = 28 }) {
  const list = (handles || []).filter(Boolean)
  if (!list.length) {
    return <span className="text-sm text-ink-3">社区推荐</span>
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {list.map((h) => (
        <XHandle
          key={h}
          handle={h}
          product={product}
          catalogAvatars={catalogAvatars}
          size={size}
        />
      ))}
    </div>
  )
}
