import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-line-soft bg-surface">
      <div className="shell py-10 text-center text-ink-3 text-[14.5px]">
        <p>
          <span className="text-ink-2 font-semibold">AI Coding Hunt</span>
          {' · '}
          <a className="text-ink-2 hover:text-accent font-medium" href="https://x.com/vista8" target="_blank" rel="noopener noreferrer">
            @vista8
          </a>
          {' · '}
          <a className="text-ink-2 hover:text-accent font-medium" href="https://github.com/joeseesun/aicodinghunt" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          {' · '}
          <Link className="text-ink-2 hover:text-accent font-medium" to="/submit">
            投稿
          </Link>
        </p>
        <p className="mt-2 text-[13px] text-ink-4">开源 MIT · 内容来自社区自荐，非官方测评</p>
      </div>
    </footer>
  )
}
