export default function EmptyState({ message = '没有匹配的工具。', action }) {
  return (
    <div className="py-20 px-6 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-md bg-chip border border-line-soft grid place-items-center text-[28px] mb-5 shadow-tile">
        ⌕
      </div>
      <p className="text-[17px] font-semibold text-ink">{message}</p>
      <p className="mt-2 text-[14.5px] text-ink-3 max-w-[36ch] leading-relaxed">
        猎场里都是社区自荐的真实在用项目，换个分类或清空筛选再看看。
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
