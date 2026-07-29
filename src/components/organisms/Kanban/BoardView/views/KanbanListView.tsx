import { useMemo, useState } from 'react'
import { useKanbanStore } from '../../../../../store/useKanbanStore'
import { IssueTypeIcon } from '../../../../atoms/IssueTypeIcon'
import { PriorityDot } from '../../../../atoms/PriorityDot'
import { DueDateChip } from '../../../../molecules/DueDateChip'
import { EmptyState } from '../../../../molecules/EmptyState'
import { filterAndSortTasks, PRIORITY_ORDER, keySeq, isTaskOverdue } from '../../../../../utils/kanban'
import type { Board, KanbanTask } from '../../../../../types/kanban.types'
import { Icon } from '../../../../../icons/Icon'

type SortKey = 'key' | 'title' | 'status' | 'priority' | 'due'

interface Props { board: Board }

function SortHeader({ label, sortKey, active, asc, onSort }: {
  label: string; sortKey: SortKey; active: boolean; asc: boolean; onSort: (k: SortKey) => void
}) {
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--text-3))] hover:text-[rgb(var(--text-2))]"
    >
      {label}
      {active && <Icon name={asc ? 'chevron-up' : 'chevron-down'} size={11} />}
    </button>
  )
}

/** Flat, sortable issue table (Jira/Asana "List" view). Children nest under parents. */
export function KanbanListView({ board }: Props): JSX.Element {
  const filters = useKanbanStore(s => s.filters)
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)
  const [sortKey, setSortKey] = useState<SortKey>('key')
  const [asc, setAsc] = useState(true)

  const colOrder = useMemo(() => {
    const m = new Map<string, number>()
    ;[...board.columns].sort((a, b) => a.order - b.order).forEach((c, i) => m.set(c.id, i))
    return m
  }, [board.columns])

  const filtered = useMemo(
    () => filterAndSortTasks(board.tasks, { ...filters, sort: 'manual' }),
    [board.tasks, filters],
  )

  const rows = useMemo(() => {
    const cmp = (a: KanbanTask, b: KanbanTask): number => {
      let r = 0
      if (sortKey === 'key') r = keySeq(a.key) - keySeq(b.key)
      else if (sortKey === 'title') r = a.title.localeCompare(b.title)
      else if (sortKey === 'status') r = (colOrder.get(a.columnId) ?? 0) - (colOrder.get(b.columnId) ?? 0)
      else if (sortKey === 'priority') r = PRIORITY_ORDER[a.priority ?? 'none'] - PRIORITY_ORDER[b.priority ?? 'none']
      else if (sortKey === 'due') r = (a.due ? Date.parse(a.due) : Infinity) - (b.due ? Date.parse(b.due) : Infinity)
      return asc ? r : -r
    }
    // Group: top-level issues sorted, each followed by its matching children.
    const passing = new Set(filtered.map(t => t.id))
    const tops = filtered.filter(t => !t.parentId).sort(cmp)
    const out: Array<{ task: KanbanTask; depth: number }> = []
    for (const top of tops) {
      out.push({ task: top, depth: 0 })
      board.tasks
        .filter(t => t.parentId === top.id && passing.has(t.id))
        .sort(cmp)
        .forEach(child => out.push({ task: child, depth: 1 }))
    }
    // Orphaned children whose parent didn't pass the filter.
    for (const t of filtered) {
      if (t.parentId && !tops.some(top => top.id === t.parentId)) out.push({ task: t, depth: 0 })
    }
    return out
  }, [filtered, board.tasks, sortKey, asc, colOrder])

  function toggleSort(key: SortKey) {
    if (key === sortKey) setAsc(a => !a)
    else { setSortKey(key); setAsc(true) }
  }

  if (board.tasks.length === 0) {
    return <div className="p-8"><EmptyState icon="layout-list" title="No issues yet" description="Create issues on the Board to see them listed here." /></div>
  }

  const hp = { active: false, asc, onSort: toggleSort }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-[rgb(var(--surface))]">
          <tr className="border-b border-[rgb(var(--border))]">
            <th className="w-10 px-3 py-2" />
            <th className="w-24 px-2 py-2"><SortHeader {...hp} label="Key" sortKey="key" active={sortKey === 'key'} /></th>
            <th className="px-2 py-2"><SortHeader {...hp} label="Summary" sortKey="title" active={sortKey === 'title'} /></th>
            <th className="w-36 px-2 py-2"><SortHeader {...hp} label="Status" sortKey="status" active={sortKey === 'status'} /></th>
            <th className="w-28 px-2 py-2"><SortHeader {...hp} label="Priority" sortKey="priority" active={sortKey === 'priority'} /></th>
            <th className="w-28 px-2 py-2"><SortHeader {...hp} label="Due" sortKey="due" active={sortKey === 'due'} /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ task, depth }) => {
            const col = board.columns.find(c => c.id === task.columnId)
            const overdue = isTaskOverdue(task, board)
            return (
              <tr
                key={task.id}
                onClick={() => setActiveTaskId(task.id)}
                className={`cursor-pointer border-b border-[rgb(var(--border))]/60 ${
                  overdue ? 'bg-red-500/[0.05] hover:bg-red-500/[0.09]' : 'hover:bg-[rgb(var(--surface-2))]'
                }`}
              >
                <td className="px-3 py-2" style={{ paddingLeft: depth ? 28 : 12 }}>
                  <IssueTypeIcon type={task.type} size={16} />
                </td>
                <td className="px-2 py-2 font-mono text-[11px] text-[rgb(var(--text-3))]">{task.key}</td>
                <td className="px-2 py-2 text-[rgb(var(--text))]">
                  <span className="line-clamp-1">{task.title}</span>
                </td>
                <td className="px-2 py-2">
                  {col && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--surface-2))] px-2 py-0.5 text-[11px] font-medium text-[rgb(var(--text-2))]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                      {col.title}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {task.priority
                    ? <span className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--text-2))]"><PriorityDot priority={task.priority} size={7} /> {task.priority}</span>
                    : <span className="text-xs text-[rgb(var(--text-3))]">—</span>}
                </td>
                <td className="px-2 py-2">
                  {task.due ? <DueDateChip due={task.due} /> : <span className="text-xs text-[rgb(var(--text-3))]">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
