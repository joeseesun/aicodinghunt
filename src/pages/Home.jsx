import { useMemo, useState } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import ProductGrid from '../components/ProductGrid'
import RankList from '../components/RankList'
import SeoHead, { SITE } from '../components/SeoHead'
import { CAT_LABELS, CAT_ORDER } from '../lib/categories'
import { sortedForView } from '../lib/metrics'
import { IconBolt, IconChevron, IconFilters } from '../lib/icons'

const VIEWS = [
  { id: 'cards', label: '卡片' },
  { id: 'likes', label: '点赞榜' },
  { id: 'impressions', label: '浏览榜' },
]

export default function Home({ data }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [view, setView] = useState('cards')
  const [hotOnly, setHotOnly] = useState(false)

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

  const list = useMemo(() => sortedForView(filtered, view), [filtered, view])

  const jsonLd = useMemo(() => {
    if (!data?.products) return null
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: '乔木 AI 工具猎场',
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

  return (
    <div className="min-h-screen flex flex-col">
      <SeoHead
        title={null}
        description={`乔木 AI 工具猎场收录 ${data.product_count} 个社区自荐 AI Coding 工具与产品。点赞、浏览可排序，支持分类检索。更新 ${data.updated_at_label}。`}
        path="/"
        jsonLd={jsonLd}
      />
      <Nav query={q} onQueryChange={setQ} onSubmit={() => {}} />

      <main className="flex-1">
        <div className="shell pt-11">
          <h1 className="text-[28px] sm:text-[31px] font-[450] tracking-[-0.022em] text-ink-2">
            {q.trim() ? (
              <>
                搜索结果 · <strong className="font-[750] text-ink">{q.trim()}</strong>
              </>
            ) : (
              <>
                乔木 <strong className="font-[750] text-ink">AI 工具猎场</strong>
              </>
            )}
          </h1>
          <p className="mt-[9px] text-[15.5px] text-ink-3 max-w-[62ch] leading-relaxed">
            来自{' '}
            <a
              className="text-ink-2 font-medium hover:text-accent transition-colors"
              href="https://x.com/vista8"
              target="_blank"
              rel="noopener noreferrer"
            >
              @vista8
            </a>{' '}
            社区自荐：把真正在用、在做的 AI 工具与项目，整理成可检索、可排序的图文目录。共{' '}
            <strong className="text-ink-2 font-semibold">{data.product_count}</strong> 个产品 · 更新{' '}
            {data.updated_at_label}
          </p>
        </div>

        <div className="shell flex items-center flex-wrap gap-2.5 pt-[34px] pb-[26px] min-w-0">
          <span className="text-[14.5px] text-ink-3 mr-1 shrink-0">热门分类:</span>
          {popular.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCat(item.id === cat ? 'all' : item.id)}
              className={`px-[17px] py-[9px] rounded-pill border text-[14.5px] whitespace-nowrap transition-[border-color,background,color,transform] duration-[180ms] ease-yarrow hover:-translate-y-px ${
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
          <section className="rounded-md border border-line-soft bg-surface p-7 shadow-tile">
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
              的全部回复。纯闲聊已剔除；同一产品多条推荐会合并推荐人。点赞榜 / 浏览榜取自原帖回复的
              public_metrics；缺失标为「—」并排后。推荐人头像来自 X 公开资料，点击可直达关注。每个产品可进详情页，也可回原帖。
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
