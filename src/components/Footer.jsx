export default function Footer() {
  return (
    <footer className="border-t border-line-soft bg-surface">
      <div className="shell py-10 text-center text-ink-3 text-[14.5px]">
        <p>
          向阳乔木 ·{' '}
          <a className="text-ink-2 hover:text-accent font-medium" href="https://www.qiaomu.ai/" target="_blank" rel="noopener noreferrer">
            qiaomu.ai
          </a>{' '}
          ·{' '}
          <a className="text-ink-2 hover:text-accent font-medium" href="https://x.com/vista8" target="_blank" rel="noopener noreferrer">
            @vista8
          </a>{' '}
          ·{' '}
          <a className="text-ink-2 hover:text-accent font-medium" href="https://github.com/joeseesun/aicodinghunt" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
        <p className="mt-2 text-[13px] text-ink-4">开源 MIT · 内容来自社区自荐，非官方测评</p>
      </div>
    </footer>
  )
}
