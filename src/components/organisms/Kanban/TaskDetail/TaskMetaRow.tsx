import { useState } from 'react'
import { Calendar, ChevronDown, Trash2 } from 'lucide-react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { useConfirmStore } from '../../../../store/useConfirmStore'
import { PriorityDot } from '../../../atoms/PriorityDot'
import { formatDate } from '../../../../utils/kanban'
import type { Board, KanbanTask, Priority } from '../../../../types/kanban.types'

const PRIORITIES: Array<Priority | null> = [null, 'low', 'medium', 'high', 'urgent']
const PRIORITY_LABELS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }

interface Props {
  task: KanbanTask
  board: Board
}

export function TaskMetaRow({ task, board }: Props) {
  const updateTask      = useKanbanStore(s => s.updateTask)
  const deleteTask      = useKanbanStore(s => s.deleteTask)
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)

  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [showColumnMenu,   setShowColumnMenu]   = useState(false)

  const sortedColumns = [...board.columns].sort((a, b) => a.order - b.order)
  const currentColumn = board.columns.find(c => c.id === task.columnId)

  function handleDelete() {
    void useConfirmStore.getState().confirm({
      title: `Delete "${task.title}"?`,
      message: 'This task will be permanently deleted.',
      confirmLabel: 'Delete',
      danger: true,
    }).then(confirmed => {
      if (confirmed) {
        deleteTask(board.id, task.id)
        setActiveTaskId(null)
      }
    })
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {/* Column picker */}
      <div className="relative">
        <button
          onClick={() => { setShowColumnMenu(v => !v); setShowPriorityMenu(false) }}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--text-2))] hover:border-[rgb(var(--accent))]"
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentColumn?.color ?? '#888' }} />
          {currentColumn?.title ?? 'Unknown'}
          <ChevronDown size={11} />
        </button>
        {showColumnMenu && (
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-lg">
            {sortedColumns.map(col => (
              <button
                key={col.id}
                onClick={() => { updateTask(board.id, task.id, { columnId: col.id }); setShowColumnMenu(false) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color }} />
                {col.title}
                {col.id === task.columnId && <span className="ml-auto text-[rgb(var(--accent))]">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Priority picker */}
      <div className="relative">
        <button
          onClick={() => { setShowPriorityMenu(v => !v); setShowColumnMenu(false) }}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--text-2))] hover:border-[rgb(var(--accent))]"
        >
          {task.priority
            ? <><PriorityDot priority={task.priority} size={6} /> {PRIORITY_LABELS[task.priority]}</>
            : 'No priority'
          }
          <ChevronDown size={11} />
        </button>
        {showPriorityMenu && (
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-lg">
            {PRIORITIES.map(p => (
              <button
                key={p ?? 'none'}
                onClick={() => { updateTask(board.id, task.id, { priority: p }); setShowPriorityMenu(false) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
              >
                {p ? <PriorityDot priority={p} size={6} /> : <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--text-3))]" />}
                {p ? PRIORITY_LABELS[p] : 'None'}
                {task.priority === p && <span className="ml-auto text-[rgb(var(--accent))]">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Due date */}
      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--text-2))] hover:border-[rgb(var(--accent))]">
        <Calendar size={11} />
        {task.due ? formatDate(task.due) : 'Due date'}
        <input
          type="date"
          value={task.due ? task.due.split('T')[0] : ''}
          onChange={e => updateTask(board.id, task.id, { due: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
          className="absolute h-0 w-0 opacity-0"
        />
      </label>

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="ml-auto flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-xs text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:border-red-900 dark:hover:bg-red-950/30"
        title="Delete task"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
