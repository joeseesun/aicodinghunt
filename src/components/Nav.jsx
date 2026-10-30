import { Link, NavLink } from 'react-router-dom'
import { IconMark, IconSearch } from '../lib/icons'

export default function Nav({ query, onQueryChange, onSubmit, showSearch = true }) {
  return (
    <header className="bg-surface border-b border-line-soft sticky top-0 z-40">
      <div className="shell flex h-[72px] sm:h-[80px] items-center gap-4 sm:gap-[22px] min-w-0">
        <Link
          to="/"
          className="flex items-center gap-[9px] shrink-0 text-[21px] sm:text-[24px] font-[750] tracking-[-0.03em] text-ink"
        >
          <span className="text-accent">
            <IconMark size={26} />
          </span>
          <span className="leading-none">AI Coding Hunt</span>
        </Link>

        {showSearch ? (
          <form
            className="flex flex-1 min-w-0 max-w-[440px] items-center gap-2.5 h-12 sm:h-[52px] pl-[18px] sm:pl-[20px] pr-1.5 bg-chip rounded-pill border border-transparent transition-[background,border-color] duration-200 ease-yarrow hover:bg-chip-hover focus-within:border-line"
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit?.()
            }}
          >
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="搜索工具、Agent、推荐人…"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px] text-ink placeholder:text-ink-4"
              aria-label="搜索工具"
            />
            <button
              type="submit"
              className="w-[38px] h-[38px] shrink-0 rounded-pill bg-accent text-white grid place-items-center transition-[background,transform] duration-200 ease-yarrow hover:bg-accent-hi active:scale-95"
              aria-label="搜索"
            >
              <IconSearch size={17} />
            </button>
          </form>
        ) : (
          <div className="flex-1" />
        )}

        <nav className="hidden md:flex items-center gap-0.5 shrink-0">
          <a
            href="https://x.com/vista8/status/2115318655525523714"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-sm text-[14.5px] font-semibold text-ink-2 hover:text-ink hover:bg-chip transition-colors duration-[180ms] ease-yarrow"
          >
            源帖
          </a>
          <a
            href="https://github.com/joeseesun/aicodinghunt"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-sm text-[14.5px] font-semibold text-ink-2 hover:text-ink hover:bg-chip transition-colors duration-[180ms] ease-yarrow"
          >
            GitHub
          </a>
        </nav>

        <NavLink
          to="/submit"
          className={({ isActive }) =>
            `ml-auto sm:ml-0 shrink-0 inline-flex items-center h-10 sm:h-11 px-4 sm:px-5 rounded-pill text-[14.5px] font-semibold transition-[background,border-color,color] duration-200 ease-yarrow ${
              isActive
                ? 'bg-ink text-surface border border-ink'
                : 'bg-accent text-white border border-accent hover:bg-accent-hi'
            }`
          }
        >
          投稿
        </NavLink>
      </div>
    </header>
  )
}
