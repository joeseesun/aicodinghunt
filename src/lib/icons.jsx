export function IconSearch({ size = 19 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.6" />
      <path d="m15.8 15.8 4 4" />
    </svg>
  )
}

export function IconChevron({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9.5 6 6 6-6" />
    </svg>
  )
}

export function IconBolt({ size = 14, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.6 2.4 5.2 13.6h5l-1.4 8 8.6-11.4h-5.2l1.4-7.8Z" />
    </svg>
  )
}

export function IconFilters({ size = 19 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <path d="M3.6 7.4h4.2M12.6 7.4h7.8M3.6 16.6h7.8M15.6 16.6h4.8" />
      <circle cx="10.2" cy="7.4" r="2.4" />
      <circle cx="13.8" cy="16.6" r="2.4" />
    </svg>
  )
}

export function IconMark({ size = 27 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.2 4.8 19.2h3.1l1.35-3.1h5.5l1.35 3.1H19.2L12 3.2Zm.9 10.2h-1.8L12 9.1l.9 4.3Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconExternal({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
      <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
    </svg>
  )
}
