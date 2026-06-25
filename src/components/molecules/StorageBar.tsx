import { formatBytes } from '../../tiers/checks'

interface StorageBarProps {
  used: number
  /** Quota in bytes. Infinity renders an "unlimited" state with no fill. */
  total: number
}

/** Returns the fill color + percent for a usage ratio. */
function usageState(pct: number): { color: string; text: string } {
  if (pct >= 100) return { color: 'rgb(239 68 68)', text: 'text-red-500' }
  if (pct >= 80)  return { color: 'rgb(234 179 8)',  text: 'text-yellow-500' }
  return { color: 'rgb(var(--accent))', text: 'text-[rgb(var(--text-2))]' }
}

export function StorageBar({ used, total }: StorageBarProps): JSX.Element {
  const unlimited = !isFinite(total)
  const pct = unlimited || total <= 0 ? 0 : Math.min(100, (used / total) * 100)
  const state = usageState(unlimited ? 0 : pct)

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className={`font-medium ${state.text}`}>{formatBytes(used)}</span>
        <span className="text-xs text-[rgb(var(--text-3))]">
          {unlimited ? 'Unlimited' : `of ${formatBytes(total)}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-2))]">
        {!unlimited && (
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.max(pct, used > 0 ? 2 : 0)}%`, backgroundColor: state.color }}
          />
        )}
      </div>
    </div>
  )
}
