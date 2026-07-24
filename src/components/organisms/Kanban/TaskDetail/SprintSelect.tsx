import { useState } from 'react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import type { Board, KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface Props {
  board: Board
  task: KanbanTask
}

/** Assigns an issue to a sprint (or the backlog) from the details sidebar. */
export function SprintSelect({ board, task }: Props): JSX.Element {
  const moveTaskToSprint = useKanbanStore(s => s.moveTaskToSprint)
  const [open, setOpen] = useState(false)
  const sprints = [...(board.sprints ?? [])].sort((a, b) => a.order - b.order)
  const current = sprints.find(s => s.id === task.sprintId)

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs hover:bg-[rgb(var(--surface-2))]">
        <span className={current ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-3))]'}>{current?.name ?? 'Backlog'}</span>
        <Icon name="chevron-down" size={11} className="text-[rgb(var(--text-3))]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[150px] rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-1 shadow-lg">
            <button onClick={() => { moveTaskToSprint(board.id, task.id, null); setOpen(false) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]">
              Backlog
              {!task.sprintId && <Icon name="check" size={12} className="ml-auto text-[rgb(var(--accent))]" />}
            </button>
            {sprints.map(s => (
              <button key={s.id} onClick={() => { moveTaskToSprint(board.id, task.id, s.id); setOpen(false) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]">
                <Icon name="layers" size={12} className="text-[rgb(var(--text-3))]" /> {s.name}
                {task.sprintId === s.id && <Icon name="check" size={12} className="ml-auto text-[rgb(var(--accent))]" />}
              </button>
            ))}
            {sprints.length === 0 && <p className="px-3 py-1.5 text-xs text-[rgb(var(--text-3))]">No sprints yet</p>}
          </div>
        </>
      )}
    </div>
  )
}
