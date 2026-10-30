import ProductCard from './ProductCard'
import EmptyState from './EmptyState'

export default function ProductGrid({ products }) {
  if (!products.length) {
    return <EmptyState />
  }
  return (
    <section className="grid grid-cols-1 min-[561px]:grid-cols-2 min-[901px]:grid-cols-3 min-[1281px]:grid-cols-4 gap-y-11 gap-x-[22px] pb-16">
      {products.map((p) => (
        <ProductCard key={p.id || p.slug} product={p} />
      ))}
    </section>
  )
}
