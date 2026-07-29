import { useState } from 'react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { tagTextColor } from '../../../../utils/kanban'
import type { Board, KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface Props {
  board: Board
  task: KanbanTask
}

/** Prominent status (column) dropdown, styled like Jira's status button. */
export function StatusSelect({ board, task }: Props): JSX.Element {
  const updateTask = useKanbanStore(s => s.updateTask)
  const [open, setOpen] = useState(false)
  const columns = [...board.columns].sort((a, b) => a.order - b.order)
  const current = columns.find(c => c.id === task.columnId)
  const bg = current?.color ?? '#64748b'
  const fg = tagTextColor(bg)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition hover:brightness-110"
        style={{ backgroundColor: bg, color: fg }}
      >
        {current?.title ?? 'Status'}
        <Icon name="chevron-down" size={13} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-1 shadow-lg">
            {columns.map(col => (
              <button
                key={col.id}
                onClick={() => { updateTask(board.id, task.id, { columnId: col.id }); setOpen(false) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color }} />
                {col.title}
                {col.id === task.columnId && <Icon name="check" size={12} className="ml-auto text-[rgb(var(--accent))]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
