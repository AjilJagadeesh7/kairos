import { Icon } from '../../../../../icons/Icon'
import type { IconToken } from '../../../../../icons/tokens'

export interface Segment { label: string; value: number; color: string }

export function StatTile({ label, value, sub, tone, icon }: {
  label: string; value: number | string; sub?: string; tone?: string; icon: IconToken
}) {
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3.5">
      <div className="mb-1 flex items-center gap-1.5 text-[rgb(var(--text-3))]">
        <Icon name={icon} size={13} />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums" style={{ color: tone ?? 'rgb(var(--text))' }}>{value}</span>
        {sub && <span className="text-xs text-[rgb(var(--text-3))]">{sub}</span>}
      </div>
    </div>
  )
}

export function Bar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-xs capitalize text-[rgb(var(--text-2))]">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgb(var(--surface-3))]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[rgb(var(--text-3))]">{count}</span>
    </div>
  )
}

/** Pure-CSS donut (conic-gradient) with a center label and legend. */
export function Donut({ segments, centerValue, centerLabel }: {
  segments: Segment[]; centerValue: string; centerLabel: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  let acc = 0
  const stops = total === 0
    ? 'rgb(var(--surface-3)) 0% 100%'
    : segments.filter(s => s.value > 0).map(s => {
        const start = (acc / total) * 100
        acc += s.value
        return `${s.color} ${start}% ${(acc / total) * 100}%`
      }).join(', ')

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-28 w-28 shrink-0" style={{ background: `conic-gradient(${stops})`, borderRadius: '50%' }}>
        <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-[rgb(var(--surface))]">
          <span className="text-xl font-bold tabular-nums text-[rgb(var(--text))]">{centerValue}</span>
          <span className="text-[10px] uppercase tracking-wide text-[rgb(var(--text-3))]">{centerLabel}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-[rgb(var(--text-2))]">{s.label}</span>
            <span className="tabular-nums text-[rgb(var(--text-3))]">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-3))]">{title}</h3>
      {children}
    </section>
  )
}
