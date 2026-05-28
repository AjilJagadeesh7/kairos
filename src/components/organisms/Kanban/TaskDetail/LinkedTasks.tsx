import { useState } from 'react'

import { useKanbanStore } from '../../../../store/useKanbanStore'
import { PriorityDot } from '../../../atoms/PriorityDot'
import type { Board, KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface Props {
  boardId: string
  board: Board
  task: KanbanTask
}

export function LinkedTasks({ boardId, board, task }: Props): JSX.Element {
  const [searching, setSearching] = useState(false)
  const [query, setQuery]         = useState('')
  const updateTask      = useKanbanStore(s => s.updateTask)
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)

  const candidates = board.tasks.filter(t =>
    t.id !== task.id && !task.linkedTasks.includes(t.id) &&
    (!query || t.title.toLowerCase().includes(query.toLowerCase())),
  )

  const linkedTaskObjs = task.linkedTasks
    .map(id => {
      const t   = board.tasks.find(bt => bt.id === id)
      if (!t) return null
      const col = board.columns.find(c => c.id === t.columnId)
      return { task: t, colTitle: col?.title ?? '' }
    })
    .filter(Boolean) as Array<{ task: KanbanTask; colTitle: string }>

  function link(taskId: string) {
    updateTask(boardId, task.id, { linkedTasks: [...task.linkedTasks, taskId] })
    setSearching(false)
    setQuery('')
  }

  function unlink(taskId: string) {
    updateTask(boardId, task.id, { linkedTasks: task.linkedTasks.filter(id => id !== taskId) })
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {linkedTaskObjs.map(({ task: linked, colTitle }) => (
        <div
          key={linked.id}
          className="group flex items-center gap-1.5 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] pl-2 pr-1 py-1 transition-colors hover:border-[rgb(var(--accent))]/40 hover:bg-[rgb(var(--surface-3))]"
        >
          <PriorityDot priority={linked.priority} size={6} />
          <span className="max-w-[140px] truncate text-[12px] font-medium text-[rgb(var(--text))]">{linked.title}</span>
          {colTitle && (
            <span className="text-[11px] text-[rgb(var(--text-3))]">· {colTitle}</span>
          )}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setActiveTaskId(linked.id)}
              title="Open task"
              className="rounded-full p-1 text-[rgb(var(--text-3))] transition hover:text-[rgb(var(--accent))]"
            >
              <Icon name="arrow-up-right" size={10} />
            </button>
            <button
              onClick={() => unlink(linked.id)}
              title="Unlink"
              className="rounded-full p-1 text-[rgb(var(--text-3))] transition hover:text-red-500"
            >
              <Icon name="x" size={10} />
            </button>
          </div>
        </div>
      ))}

      {searching ? (
        <div className="relative">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && (setSearching(false), setQuery(''))}
            placeholder="Search tasks on this board…"
            className="w-full rounded-lg border border-[rgb(var(--accent))]/60 bg-[rgb(var(--surface-2))] px-3 py-2 text-[13px] text-[rgb(var(--text))] outline-none placeholder-[rgb(var(--text-3))]"
          />
          {candidates.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-xl">
              {candidates.slice(0, 8).map(t => {
                const col = board.columns.find(c => c.id === t.columnId)
                return (
                  <button
                    key={t.id}
                    onClick={() => link(t.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))]"
                  >
                    <PriorityDot priority={t.priority} size={6} />
                    <span className="flex-1 truncate">{t.title}</span>
                    {col && <span className="shrink-0 text-[11px] text-[rgb(var(--text-3))]">{col.title}</span>}
                  </button>
                )
              })}
            </div>
          )}
          {candidates.length === 0 && query && (
            <p className="mt-1.5 text-center text-xs text-[rgb(var(--text-3))]">No tasks found</p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setSearching(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--accent))]"
        >
          <Icon name="plus" size={12} /> Link task
        </button>
      )}
    </div>
  )
}
