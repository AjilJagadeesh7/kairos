import { useState } from 'react'
import { Link2, Plus, X } from 'lucide-react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { PriorityDot } from '../../../atoms/PriorityDot'
import type { Board, KanbanTask } from '../../../../types/kanban.types'

interface LinkedTasksProps {
  boardId: string
  board: Board
  task: KanbanTask
}

export function LinkedTasks({ boardId, board, task }: LinkedTasksProps): JSX.Element {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const updateTask = useKanbanStore(s => s.updateTask)
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)

  const candidates = board.tasks.filter(t =>
    t.id !== task.id && !task.linkedTasks.includes(t.id),
  )

  const filtered = candidates.filter(t =>
    t.title.toLowerCase().includes(query.toLowerCase()),
  )

  function linkTask(taskId: string) {
    updateTask(boardId, task.id, { linkedTasks: [...task.linkedTasks, taskId] })
    setSearching(false)
    setQuery('')
  }

  function unlinkTask(taskId: string) {
    updateTask(boardId, task.id, { linkedTasks: task.linkedTasks.filter(id => id !== taskId) })
  }

  const linkedTaskObjects = task.linkedTasks
    .map(id => {
      const t = board.tasks.find(bt => bt.id === id)
      if (!t) return null
      const col = board.columns.find(c => c.id === t.columnId)
      return { task: t, colTitle: col?.title ?? '' }
    })
    .filter(Boolean) as Array<{ task: KanbanTask; colTitle: string }>

  return (
    <div className="flex flex-col gap-2">
      {linkedTaskObjects.map(({ task: linked, colTitle }) => (
        <div key={linked.id} className="group flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2">
          <Link2 size={13} className="flex-shrink-0 text-[rgb(var(--text-3))]" />
          <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
            <PriorityDot priority={linked.priority} size={6} />
            <span className="truncate text-sm text-[rgb(var(--text))]">{linked.title}</span>
            <span className="flex-shrink-0 text-xs text-[rgb(var(--text-3))]">· {colTitle}</span>
          </div>
          <button
            onClick={() => setActiveTaskId(linked.id)}
            className="hidden text-xs text-[rgb(var(--accent))] underline hover:no-underline group-hover:block"
          >
            View
          </button>
          <button
            onClick={() => unlinkTask(linked.id)}
            className="hidden text-[rgb(var(--text-3))] hover:text-red-500 group-hover:block"
          >
            <X size={13} />
          </button>
        </div>
      ))}

      {searching ? (
        <div className="relative">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setSearching(false)}
            placeholder="Search tasks on this board…"
            className="w-full rounded-lg border border-[rgb(var(--accent))] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm text-[rgb(var(--text))] outline-none placeholder-[rgb(var(--text-3))]"
          />
          {filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-lg">
              {filtered.slice(0, 8).map(t => (
                <button
                  key={t.id}
                  onClick={() => linkTask(t.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
                >
                  <PriorityDot priority={t.priority} size={6} />
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
            </div>
          )}
          {filtered.length === 0 && query && (
            <p className="mt-1 text-center text-xs text-[rgb(var(--text-3))]">No tasks found</p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setSearching(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--accent))]"
        >
          <Plus size={12} /> Link task
        </button>
      )}
    </div>
  )
}
