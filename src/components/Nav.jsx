import { Link } from 'react-router-dom'
import { IconMark, IconSearch } from '../lib/icons'

export default function Nav({ query, onQueryChange, onSubmit }) {
  return (
    <header className="bg-surface border-b border-line-soft">
      <div className="shell flex h-[88px] items-center gap-[26px] min-w-0">
        <Link
          to="/"
          className="flex items-center gap-[9px] shrink-0 text-[22px] sm:text-[25px] font-[750] tracking-[-0.03em] text-ink"
        >
          <span className="text-accent">
            <IconMark />
          </span>
          <span className="leading-none">
            AI Coding Hunt
            <span className="hidden md:inline text-ink-3 font-semibold text-[13px] ml-2 tracking-normal align-middle">
              乔木 AI 工具猎场
            </span>
          </span>
        </Link>

        <form
          className="flex flex-1 min-w-0 max-w-[470px] items-center gap-2.5 h-14 pl-[22px] pr-2 bg-chip rounded-pill border border-transparent transition-[background,border-color] duration-200 ease-yarrow hover:bg-chip-hover focus-within:border-line"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit?.()
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索名称、描述、推荐人…"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15.5px] text-ink placeholder:text-ink-4"
            aria-label="搜索工具"
          />
          <button
            type="submit"
            className="w-[42px] h-[42px] shrink-0 rounded-pill bg-accent text-white grid place-items-center transition-[background,transform] duration-200 ease-yarrow hover:bg-accent-hi active:scale-95"
            aria-label="搜索"
          >
            <IconSearch />
          </button>
        </form>

        <div className="hidden lg:flex items-center gap-1 ml-0.5 shrink-0">
          <a
            href="https://x.com/vista8/status/2115318655525523714"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-sm text-[15px] font-semibold text-ink-2 hover:text-ink hover:bg-chip transition-colors duration-[180ms] ease-yarrow"
          >
            源帖
          </a>
          <a
            href="https://github.com/joeseesun/aicodinghunt"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-sm text-[15px] font-semibold text-ink-2 hover:text-ink hover:bg-chip transition-colors duration-[180ms] ease-yarrow"
          >
            GitHub
          </a>
        </div>

        <div className="ml-auto shrink-0 hidden sm:flex items-center gap-3">
          <a
            href="https://www.qiaomu.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center h-11 px-5 rounded-pill border border-line bg-surface text-[15px] font-semibold text-ink transition-[border-color,background,transform] duration-200 ease-yarrow hover:border-[#c4cad7] hover:bg-chip active:translate-y-px"
          >
            qiaomu.ai
          </a>
        </div>
      </div>
    </header>
  )
}
