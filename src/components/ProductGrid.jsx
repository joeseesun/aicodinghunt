import ProductCard from './ProductCard'
import EmptyState from './EmptyState'

export default function ProductGrid({ products, catalogAvatars }) {
  if (!products?.length) {
    return <EmptyState message="没有匹配的工具。试试换个关键词，或关掉「仅看热门」。" />
  }

  return (
    <div className="grid grid-cols-1 min-[561px]:grid-cols-2 min-[901px]:grid-cols-3 min-[1281px]:grid-cols-4 gap-y-11 gap-x-[22px] pb-16">
      {products.map((p) => (
        <ProductCard key={p.id || p.slug} product={p} catalogAvatars={catalogAvatars} />
      ))}
    </div>
  )
}
