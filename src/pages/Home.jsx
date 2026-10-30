import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import ProductGrid from '../components/ProductGrid'
import RankList from '../components/RankList'
import SeoHead, { SITE } from '../components/SeoHead'
import { CAT_LABELS, CAT_ORDER } from '../lib/categories'
import { sortedForView } from '../lib/metrics'
import { useSiteMetrics } from '../lib/siteMetrics'
import { IconBolt, IconChevron, IconFilters, IconSearch } from '../lib/icons'

const VIEWS = [
  { id: 'cards', label: '卡片' },
  { id: 'site', label: '本站点赞榜' },
  { id: 'likes', label: '社区点赞榜' },
  { id: 'impressions', label: '社区浏览榜' },
]

export default function Home({ data }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [view, setView] = useState('cards')
  const [hotOnly, setHotOnly] = useState(false)
  const { metrics: siteMetrics } = useSiteMetrics()

  const categories = useMemo(() => {
    const counts = data?.categories || {}
    return CAT_ORDER.filter((c) => counts[c])
  }, [data])

  const popular = useMemo(() => {
    return categories.slice(0, 8).map((c) => ({
      id: c,
      label: CAT_LABELS[c] || c,
    }))
  }, [categories])

  const filtered = useMemo(() => {
    if (!data?.products) return []
    const needle = q.trim().toLowerCase()
    return data.products.filter((p) => {
      if (cat !== 'all' && p.category !== cat) return false
      if (hotOnly) {
        const likes = p.like_count ?? p.likes
        const imps = p.impression_count ?? p.impressions
        if (!((likes != null && likes >= 10) || (imps != null && imps >= 2000))) return false
      }
      if (!needle) return true
      const blob = [
        p.name,
        p.summary,
        p.description,
        p.detail,
        p.url,
        ...(p.recommenders || []),
        ...(p.tags || []),
        ...(p.capabilities || []),
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(needle)
    })
  }, [data, q, cat, hotOnly])

  const list = useMemo(
    () => sortedForView(filtered, view, siteMetrics),
    [filtered, view, siteMetrics],
  )

  const jsonLd = useMemo(() => {
    if (!data?.products) return null
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'AI Coding Hunt',
      description:
        '来自 @vista8 社区自荐的 AI Coding 工具、Agent、插件与开源项目目录。',
      url: `${SITE}/`,
      numberOfItems: data.product_count,
      itemListElement: data.products.slice(0, 40).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE}/p/${encodeURIComponent(p.slug)}/`,
        name: p.name,
      })),
    }
  }, [data])

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-3">加载中…</div>
    )
  }

  const searching = Boolean(q.trim())

  return (
    <div className="min-h-screen flex flex-col">
      <SeoHead
        title={null}
        description={`AI Coding Hunt 收录 ${data.product_count} 个社区自荐 AI Coding 工具与产品。点赞、浏览可排序，支持分类检索。更新 ${data.updated_at_label}。`}
        path="/"
        jsonLd={jsonLd}
      />
      <Nav query={q} onQueryChange={setQ} onSubmit={() => {}} showSearch={true} />

      <main className="flex-1">
        {!searching ? (
          <section className="relative overflow-hidden border-b border-line-soft bg-surface">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-16 w-[420px] h-[420px] rounded-full bg-accent/[0.06]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-28 -left-20 w-[360px] h-[360px] rounded-full bg-[#4f9a6a]/[0.06]"
            />
            <div className="shell relative pt-12 sm:pt-16 pb-12 sm:pb-14">
              <div className="max-w-[760px]">
                <p className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-[0.04em] uppercase text-accent">
                  Community catalog
                  <span className="w-1 h-1 rounded-full bg-ink-4" />
                  社区自荐
                </p>
                <h1 className="mt-3 text-[34px] sm:text-[44px] font-[750] tracking-[-0.035em] leading-[1.12] text-ink">
                  发现真正在用的
                  <br className="hidden sm:block" />
                  <span className="text-accent"> AI Coding </span>
                  工具
                </h1>
                <p className="mt-4 text-[16px] sm:text-[17px] text-ink-3 leading-relaxed max-w-[54ch]">
                  把 X 上自荐的 Agent、插件、CLI 与开源项目，整理成可检索、可排序的图文猎场。不靠广告位，只看社区真实在用。
                </p>
              </div>

              <form
                className="mt-8 flex w-full max-w-[560px] items-center gap-2.5 h-14 pl-[22px] pr-2 bg-chip rounded-pill border border-line-soft focus-within:border-line focus-within:bg-surface transition-[background,border-color] duration-200 ease-yarrow"
                onSubmit={(e) => e.preventDefault()}
              >
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="试试 Cursor、Agent、剪贴板、Skill…"
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15.5px] text-ink placeholder:text-ink-4"
                  aria-label="搜索工具"
                />
                <button
                  type="submit"
                  className="w-11 h-11 shrink-0 rounded-pill bg-accent text-white grid place-items-center hover:bg-accent-hi transition-colors"
                  aria-label="搜索"
                >
                  <IconSearch size={18} />
                </button>
              </form>

              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center h-9 px-3.5 rounded-pill bg-chip text-[13.5px] font-semibold text-ink-2 tabular-nums">
                  {data.product_count} 个产品
                </span>
                <span className="inline-flex items-center h-9 px-3.5 rounded-pill bg-chip text-[13.5px] font-semibold text-ink-2">
                  {categories.length} 个分类
                </span>
                <span className="inline-flex items-center h-9 px-3.5 rounded-pill bg-chip text-[13.5px] font-semibold text-ink-2">
                  更新 {data.updated_at_label}
                </span>
                <Link
                  to="/submit"
                  className="inline-flex items-center h-9 px-3.5 rounded-pill border border-line bg-surface text-[13.5px] font-semibold text-ink hover:bg-chip transition-colors"
                >
                  提交你的工具 →
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <div className="shell pt-10">
            <h1 className="text-[28px] sm:text-[31px] font-[450] tracking-[-0.022em] text-ink-2">
              搜索结果 · <strong className="font-[750] text-ink">{q.trim()}</strong>
            </h1>
            <p className="mt-2 text-[15px] text-ink-3">{list.length} 个匹配</p>
          </div>
        )}

        <div className="shell flex items-center flex-wrap gap-2.5 pt-[30px] pb-[22px] min-w-0">
          <span className="text-[14.5px] text-ink-3 mr-1 shrink-0">热门分类:</span>
          {popular.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCat(item.id === cat ? 'all' : item.id)}
              className={`px-[17px] py-[9px] rounded-pill border text-[14.5px] whitespace-nowrap transition-[border-color,background,color] duration-[180ms] ease-yarrow ${
                cat === item.id
                  ? 'bg-ink text-surface border-ink'
                  : 'bg-surface text-ink-2 border-line hover:bg-chip hover:border-[#c8cedb] hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="shell">
          <div className="h-px bg-line-soft" />
        </div>

        <div className="shell flex items-center flex-wrap gap-3 pt-[22px] pb-[30px] min-w-0">
          <button
            type="button"
            className="w-11 h-11 shrink-0 rounded-pill border border-line text-ink-2 grid place-items-center bg-surface transition-[border-color,background] duration-[180ms] ease-yarrow hover:bg-chip hover:border-[#c8cedb]"
            aria-label="全部分类"
            onClick={() => setCat('all')}
            title="全部"
          >
            <IconFilters />
          </button>

          <div className="relative">
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="appearance-none inline-flex items-center h-11 pl-4 pr-10 rounded-pill border border-line bg-surface text-[14.5px] font-semibold text-ink-2 cursor-pointer transition-[border-color,background,color] duration-[180ms] ease-yarrow hover:bg-chip hover:border-[#c8cedb] hover:text-ink"
              aria-label="分类筛选"
            >
              <option value="all">全部分类 · {data.product_count}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CAT_LABELS[c] || c} · {data.categories[c]}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3">
              <IconChevron />
            </span>
          </div>

          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`inline-flex items-center h-11 px-4 rounded-pill border text-[14.5px] font-semibold transition-[border-color,background,color] duration-[180ms] ease-yarrow ${
                view === v.id
                  ? 'bg-ink text-surface border-ink'
                  : 'bg-surface text-ink-2 border-line hover:bg-chip hover:border-[#c8cedb] hover:text-ink'
              }`}
              role="tab"
              aria-selected={view === v.id}
            >
              {v.label}
            </button>
          ))}

          <span className="flex items-center gap-2.5 ml-0 sm:ml-3.5 shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={hotOnly}
              aria-label="仅看热门"
              onClick={() => setHotOnly((x) => !x)}
              className={`relative w-[46px] h-[26px] rounded-pill transition-colors duration-[220ms] ease-yarrow ${
                hotOnly ? 'bg-accent' : 'bg-[#ccd2df] hover:bg-[#c1c8d5]'
              }`}
            >
              <span
                className={`absolute top-[3px] left-[3px] w-5 h-5 rounded-pill bg-surface shadow-[0_1px_3px_rgba(15,18,25,0.28)] transition-transform duration-[220ms] ease-yarrow ${
                  hotOnly ? 'translate-x-5' : ''
                }`}
              />
            </button>
            <span className="flex items-center gap-[7px] text-[15px] font-semibold text-ink">
              <IconBolt className="text-bolt" size={16} />
              仅看热门
            </span>
          </span>

          <span className="ml-auto text-[13.5px] text-ink-4 tabular-nums hidden sm:inline">
            {list.length} 个结果
          </span>
        </div>

        <div className="shell">
          {view === 'cards' ? (
            <ProductGrid products={list} catalogAvatars={data.avatars} />
          ) : (
            <RankList products={list} view={view} catalogAvatars={data.avatars} />
          )}
        </div>

        <div className="shell pb-16">
          <section className="rounded-md border border-line-soft bg-surface p-7">
            <h2 className="text-[18px] font-bold text-ink">关于这份目录</h2>
            <p className="mt-3 text-[14.5px] text-ink-3 leading-relaxed max-w-[70ch]">
              数据来自{' '}
              <a
                className="text-ink-2 hover:text-accent font-medium"
                href={data.source_post}
                target="_blank"
                rel="noopener noreferrer"
              >
                X 自荐帖
              </a>{' '}
              的全部回复。本站另有独立的「本站点赞 / 本站浏览」（访客 UUID + IP 回退去重，与 X 社区点赞分开）。卡片默认按本站点赞排序；也可切到社区点赞榜 / 社区浏览榜。推荐人头像来自 X 公开资料。也可以{' '}
              <Link to="/submit" className="text-ink-2 hover:text-accent font-medium">
                在线投稿
              </Link>
              。
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
