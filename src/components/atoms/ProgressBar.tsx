interface ProgressBarProps {
  done: number
  total: number
  className?: string
}

export function ProgressBar({ done, total, className = '' }: ProgressBarProps): JSX.Element | null {
  if (total === 0) return null
  const pct = Math.round((done / total) * 100)
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgb(var(--surface-3))]">
        <div
          className="h-full rounded-full bg-[rgb(var(--accent))] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="flex-shrink-0 text-xs text-[rgb(var(--text-3))]">
        {done}/{total}
      </span>
    </div>
  )
}
