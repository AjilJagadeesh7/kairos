import { useMemo } from 'react'
import { useKanbanStore } from '../../../../../store/useKanbanStore'
import { IssueTypeIcon } from '../../../../atoms/IssueTypeIcon'
import { DueDateChip } from '../../../../molecules/DueDateChip'
import { StatTile, Bar, Donut, Card } from './summaryWidgets'
import { doneColumnId, ISSUE_TYPES, ISSUE_TYPE_META, PRIORITY_COLORS, formatDate, isDueOverdue } from '../../../../../utils/kanban'
import type { Board, Priority } from '../../../../../types/kanban.types'
import { Icon } from '../../../../../icons/Icon'

interface Props { board: Board }

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']

/** Overview dashboard: completion, status/priority/type mix, sprints, due soon. */
export function KanbanSummaryView({ board }: Props): JSX.Element {
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)

  const s = useMemo(() => {
    const tasks = board.tasks
    const cols = [...board.columns].sort((a, b) => a.order - b.order)
    const doneId = doneColumnId(board)
    const todoId = cols[0]?.id
    const isDone = (t: typeof tasks[number]) => t.columnId === doneId

    const total = tasks.length
    const done = tasks.filter(isDone).length
    const todo = tasks.filter(t => t.columnId === todoId).length
    const inProgress = total - done - todo
    const pct = total ? Math.round((done / total) * 100) : 0
    const overdue = tasks.filter(t => t.due && !isDone(t) && isDueOverdue(t.due)).length

    const byStatus = cols.map(c => ({ label: c.title, count: tasks.filter(t => t.columnId === c.id).length, color: c.color }))
    const byPriority = PRIORITIES.map(p => ({ label: p, count: tasks.filter(t => t.priority === p).length, color: PRIORITY_COLORS[p] }))
    const byType = ISSUE_TYPES.map(ty => ({ label: ISSUE_TYPE_META[ty].label, count: tasks.filter(t => t.type === ty).length, color: ISSUE_TYPE_META[ty].color }))
      .filter(t => t.count > 0)

    const sprints = [...(board.sprints ?? [])].sort((a, b) => a.order - b.order).map(sp => {
      const items = tasks.filter(t => t.sprintId === sp.id)
      return { id: sp.id, name: sp.name, status: sp.status, total: items.length, done: items.filter(isDone).length }
    })

    const dueSoon = tasks
      .filter(t => t.due && !isDone(t))
      .sort((a, b) => Date.parse(a.due!) - Date.parse(b.due!))
      .slice(0, 6)

    const recent = [...tasks].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6)

    return { total, done, todo, inProgress, pct, overdue, byStatus, byPriority, byType, sprints, dueSoon, recent }
  }, [board])

  const donutSegments = [
    { label: 'To do', value: s.todo, color: '#64748b' },
    { label: 'In progress', value: s.inProgress, color: '#f59e0b' },
    { label: 'Done', value: s.done, color: '#22c55e' },
  ]

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <StatTile icon="layers" label="Total" value={s.total} />
          <StatTile icon="check-circle-2" label="Completed" value={s.done} sub={`${s.pct}%`} tone="#22c55e" />
          <StatTile icon="loader-2" label="In progress" value={s.inProgress} tone="#f59e0b" />
          <StatTile icon="list" label="To do" value={s.todo} tone="rgb(var(--text-2))" />
          <StatTile icon="alert-triangle" label="Overdue" value={s.overdue} tone={s.overdue > 0 ? '#ef4444' : 'rgb(var(--text-2))'} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Completion">
            <Donut segments={donutSegments} centerValue={`${s.pct}%`} centerLabel="Done" />
            <div className="mt-4 space-y-2 border-t border-[rgb(var(--border))]/60 pt-3">
              {s.byStatus.map(st => <Bar key={st.label} {...st} total={s.total} />)}
            </div>
          </Card>

          <Card title="Priority breakdown">
            <div className="space-y-2.5">
              {s.byPriority.map(p => <Bar key={p.label} {...p} total={s.total} />)}
            </div>
            <h4 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--text-3))]">Types of work</h4>
            <div className="space-y-2.5">
              {s.byType.length === 0
                ? <p className="text-xs text-[rgb(var(--text-3))]">No issues yet.</p>
                : s.byType.map(t => <Bar key={t.label} {...t} total={s.total} />)}
            </div>
          </Card>

          {s.sprints.length > 0 && (
            <Card title="Sprint progress">
              <div className="space-y-3">
                {s.sprints.map(sp => (
                  <div key={sp.id}>
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <Icon name="layers" size={12} className="text-[rgb(var(--text-3))]" />
                      <span className="font-medium text-[rgb(var(--text))]">{sp.name}</span>
                      <span className="capitalize text-[rgb(var(--text-3))]">· {sp.status}</span>
                      <span className="ml-auto tabular-nums text-[rgb(var(--text-3))]">{sp.done}/{sp.total}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-3))]">
                      <div className="h-full rounded-full bg-[rgb(var(--accent))] transition-[width] duration-500" style={{ width: `${sp.total ? (sp.done / sp.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Due soon & overdue">
            {s.dueSoon.length === 0
              ? <p className="text-xs text-[rgb(var(--text-3))]">Nothing with a due date.</p>
              : (
                <div className="space-y-1">
                  {s.dueSoon.map(t => (
                    <button key={t.id} onClick={() => setActiveTaskId(t.id)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-[rgb(var(--surface-2))]">
                      <IssueTypeIcon type={t.type} size={15} />
                      <span className="font-mono text-[10px] text-[rgb(var(--text-3))]">{t.key}</span>
                      <span className="flex-1 truncate text-xs text-[rgb(var(--text))]">{t.title}</span>
                      {t.due && <DueDateChip due={t.due} />}
                    </button>
                  ))}
                </div>
              )}
          </Card>

          <Card title="Recent activity">
            {s.recent.length === 0
              ? <p className="text-xs text-[rgb(var(--text-3))]">No issues yet.</p>
              : (
                <div className="space-y-1">
                  {s.recent.map(t => (
                    <button key={t.id} onClick={() => setActiveTaskId(t.id)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-[rgb(var(--surface-2))]">
                      <IssueTypeIcon type={t.type} size={15} />
                      <span className="font-mono text-[10px] text-[rgb(var(--text-3))]">{t.key}</span>
                      <span className="flex-1 truncate text-xs text-[rgb(var(--text))]">{t.title}</span>
                      <span className="flex items-center gap-1 text-[10px] text-[rgb(var(--text-3))]"><Icon name="history" size={10} /> {formatDate(t.updatedAt)}</span>
                    </button>
                  ))}
                </div>
              )}
          </Card>
        </div>
      </div>
    </div>
  )
}
