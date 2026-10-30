export default function EmptyState({ message = '没有匹配的工具。换个关键词或分类试试。' }) {
  return (
    <div className="rounded-md border border-dashed border-line bg-surface px-8 py-16 text-center text-ink-3">
      <p className="text-[16px] font-medium text-ink-2">{message}</p>
      <p className="mt-2 text-[14.5px]">试试清空搜索，或切换到「全部」分类。</p>
    </div>
  )
}
