import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import ProductDetail from './pages/ProductDetail'
import Submit from './pages/Submit'
import { SiteMetricsProvider } from './lib/siteMetrics'

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/data/products.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message || String(e)))
  }, [])

  const slugs = useMemo(
    () => (data?.products || []).map((p) => p.slug).filter(Boolean),
    [data],
  )

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center text-ink-2 p-8">
        <div className="text-center">
          <p className="text-[18px] font-bold text-ink">加载失败</p>
          <p className="mt-2 text-ink-3">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <SiteMetricsProvider slugs={slugs}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home data={data} />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/submit/" element={<Submit />} />
          <Route path="/p/:slug/" element={<ProductDetail data={data} />} />
          <Route path="/p/:slug" element={<ProductDetail data={data} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SiteMetricsProvider>
  )
}
