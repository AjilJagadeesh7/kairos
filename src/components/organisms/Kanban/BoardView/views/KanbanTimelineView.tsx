import { useMemo, useState } from 'react'
import { useKanbanStore } from '../../../../../store/useKanbanStore'
import { IssueTypeIcon } from '../../../../atoms/IssueTypeIcon'
import { EmptyState } from '../../../../molecules/EmptyState'
import { filterAndSortTasks } from '../../../../../utils/kanban'
import type { Board, KanbanTask } from '../../../../../types/kanban.types'

const DAY = 86_400_000
const DAY_PX = 30
const LABEL_W = 220

interface Props { board: Board }

function startOfDay(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** Gantt-style timeline. Bars span each issue's start → due date. */
export function KanbanTimelineView({ board }: Props): JSX.Element {
  const filters = useKanbanStore(s => s.filters)
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)
  const [todayStart] = useState(() => startOfDay(Date.now()))

  const filtered = useMemo(
    () => filterAndSortTasks(board.tasks, { ...filters, sort: 'manual' }),
    [board.tasks, filters],
  )

  const scheduled = filtered.filter(t => t.startDate || t.due)
  const unscheduled = filtered.filter(t => !t.startDate && !t.due)

  const range = useMemo(() => {
    if (scheduled.length === 0) return null
    let min = Infinity, max = -Infinity
    for (const t of scheduled) {
      const s = startOfDay(Date.parse(t.startDate ?? t.due!))
      const e = startOfDay(Date.parse(t.due ?? t.startDate!))
      min = Math.min(min, s); max = Math.max(max, e)
    }
    min -= 2 * DAY; max += 3 * DAY
    return { min, max, days: Math.round((max - min) / DAY) + 1 }
  }, [scheduled])

  if (scheduled.length === 0) {
    return (
      <div className="p-8">
        <EmptyState icon="calendar-days" title="Nothing scheduled"
          description="Set a start date and/or due date on issues to plot them on the timeline." />
        {unscheduled.length > 0 && (
          <p className="mt-2 text-center text-xs text-[rgb(var(--text-3))]">{unscheduled.length} unscheduled issue(s)</p>
        )}
      </div>
    )
  }

  const { min, days } = range!
  const gridW = days * DAY_PX

  // Month header segments.
  const months: Array<{ label: string; left: number; width: number }> = []
  let cursor = min
  while (cursor < range!.max) {
    const d = new Date(cursor)
    const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
    const nextMonth = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
    const segStart = Math.max(cursor, min)
    const segEnd = Math.min(nextMonth, range!.max)
    months.push({
      label: new Date(monthStart).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      left: ((segStart - min) / DAY) * DAY_PX,
      width: ((segEnd - segStart) / DAY) * DAY_PX,
    })
    cursor = nextMonth
  }

  const todayLeft = ((todayStart - min) / DAY) * DAY_PX

  function bar(t: KanbanTask) {
    const s = startOfDay(Date.parse(t.startDate ?? t.due!))
    const e = startOfDay(Date.parse(t.due ?? t.startDate!))
    const left = ((s - min) / DAY) * DAY_PX
    const width = Math.max(DAY_PX, ((e - s) / DAY + 1) * DAY_PX)
    return { left, width }
  }

  return (
    <div className="h-full overflow-auto">
      <div style={{ width: LABEL_W + gridW }}>
        {/* Month header */}
        <div className="sticky top-0 z-10 flex border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          <div className="shrink-0 border-r border-[rgb(var(--border))]" style={{ width: LABEL_W }} />
          <div className="relative h-8" style={{ width: gridW }}>
            {months.map((m, i) => (
              <div key={i} className="absolute top-0 flex h-8 items-center border-r border-[rgb(var(--border))] px-2 text-[11px] font-medium text-[rgb(var(--text-3))]"
                style={{ left: m.left, width: m.width }}>
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="relative">
          {todayLeft >= 0 && todayLeft <= gridW && (
            <div className="pointer-events-none absolute top-0 z-[5] w-px bg-red-500/60" style={{ left: LABEL_W + todayLeft, height: scheduled.length * 40 }} />
          )}
          {scheduled.map(t => {
            const { left, width } = bar(t)
            const col = board.columns.find(c => c.id === t.columnId)
            return (
              <div key={t.id} className="flex h-10 items-center border-b border-[rgb(var(--border))]/50 hover:bg-[rgb(var(--surface-2))]/50">
                <button
                  onClick={() => setActiveTaskId(t.id)}
                  className="flex h-full shrink-0 items-center gap-1.5 border-r border-[rgb(var(--border))] px-2 text-left"
                  style={{ width: LABEL_W }}
                >
                  <IssueTypeIcon type={t.type} size={15} />
                  <span className="font-mono text-[10px] text-[rgb(var(--text-3))]">{t.key}</span>
                  <span className="flex-1 truncate text-xs text-[rgb(var(--text))]">{t.title}</span>
                </button>
                <div className="relative h-full" style={{ width: gridW }}>
                  <button
                    onClick={() => setActiveTaskId(t.id)}
                    className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center rounded px-2 text-[10px] font-medium text-white shadow-sm transition hover:brightness-110"
                    style={{ left, width, backgroundColor: col?.color ?? 'rgb(var(--accent))' }}
                    title={`${t.key} · ${t.title}`}
                  >
                    <span className="truncate">{t.title}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {unscheduled.length > 0 && (
          <p className="px-3 py-3 text-xs text-[rgb(var(--text-3))]">
            {unscheduled.length} unscheduled issue(s) — add dates to plot them.
          </p>
        )}
      </div>
    </div>
  )
}
