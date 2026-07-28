import { useState } from 'react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { IssueTypeIcon } from '../../../atoms/IssueTypeIcon'
import { ProgressBar } from '../../../atoms/ProgressBar'
import { calcChildProgress, doneColumnId, isTaskDone, isTaskOverdue, CHILD_ISSUE_TYPES, ISSUE_TYPE_META } from '../../../../utils/kanban'
import { DueDateChip } from '../../../molecules/DueDateChip'
import type { Board, IssueType, KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface Props {
  board: Board
  task: KanbanTask
  /** How to open a child — drawer (setActiveTaskId) or full page (navigate). */
  onOpen: (taskId: string) => void
}

/** First-class child issues (subtasks/bugs) nested under a parent. */
export function ChildIssues({ board, task, onOpen }: Props): JSX.Element {
  const createChildIssue = useKanbanStore(s => s.createChildIssue)
  const updateTask = useKanbanStore(s => s.updateTask)
  const deleteTask = useKanbanStore(s => s.deleteTask)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<IssueType>('subtask')

  const children = board.tasks
    .filter(t => t.parentId === task.id)
    .sort((a, b) => a.order - b.order)
  const progress = calcChildProgress(task, board)
  const doneId = doneColumnId(board)
  const firstColId = [...board.columns].sort((a, b) => a.order - b.order)[0]?.id

  function add() {
    const trimmed = title.trim()
    if (!trimmed) return
    createChildIssue(board.id, task.id, trimmed, type)
    setTitle('')
  }

  function toggleDone(child: KanbanTask) {
    const target = isTaskDone(child, board) ? firstColId : doneId
    if (target) updateTask(board.id, child.id, { columnId: target })
  }

  return (
    <div className="flex flex-col gap-1.5">
      {progress.total > 0 && <ProgressBar done={progress.done} total={progress.total} className="mb-1" />}

      {children.map(child => {
        const done = isTaskDone(child, board)
        const overdue = isTaskOverdue(child, board)
        return (
          <div key={child.id} className={`group flex items-center gap-2 rounded-lg border px-1 py-1 hover:bg-[rgb(var(--surface-2))] ${
            overdue ? 'border-red-500/50 bg-red-500/[0.04]' : 'border-transparent hover:border-[rgb(var(--border))]'
          }`}>
            <button
              onClick={() => toggleDone(child)}
              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                done ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))] text-[rgb(var(--accent-fg))]' : 'border-[rgb(var(--border))] hover:border-[rgb(var(--accent))]'
              }`}
              title={done ? 'Mark not done' : 'Mark done'}
            >
              {done && <Icon name="check" size={10} strokeWidth={3} />}
            </button>
            <IssueTypeIcon type={child.type} size={15} />
            <span className="font-mono text-[10px] text-[rgb(var(--text-3))]">{child.key}</span>
            <button onClick={() => onOpen(child.id)} className={`flex-1 truncate text-left text-sm hover:underline ${done ? 'text-[rgb(var(--text-3))] line-through' : 'text-[rgb(var(--text))]'}`}>
              {child.title}
            </button>
            {child.due && !done && <DueDateChip due={child.due} className="shrink-0" />}
            <button onClick={() => onOpen(child.id)} className="rounded p-1 text-[rgb(var(--text-3))] opacity-0 transition hover:text-[rgb(var(--accent))] group-hover:opacity-100" title="Open issue">
              <Icon name="arrow-up-right" size={12} />
            </button>
            <button onClick={() => deleteTask(board.id, child.id)} className="rounded p-1 text-[rgb(var(--text-3))] opacity-0 transition hover:text-red-500 group-hover:opacity-100" title="Delete">
              <Icon name="trash-2" size={12} />
            </button>
          </div>
        )
      })}

      <div className="mt-1 flex items-center gap-1.5">
        <div className="flex overflow-hidden rounded-md border border-[rgb(var(--border))]">
          {CHILD_ISSUE_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              title={ISSUE_TYPE_META[t].label}
              className={`flex items-center px-1.5 py-1 transition ${type === t ? 'bg-[rgb(var(--surface-3))]' : 'opacity-50 hover:opacity-100'}`}
            >
              <IssueTypeIcon type={t} size={14} />
            </button>
          ))}
        </div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setTitle('') }}
          placeholder={`Add a ${ISSUE_TYPE_META[type].label.toLowerCase()}…`}
          className="min-w-0 flex-1 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1.5 text-sm text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--accent))]"
        />
        <button onClick={add} disabled={!title.trim()} className="rounded-md p-1.5 text-[rgb(var(--text-3))] hover:text-[rgb(var(--accent))] disabled:opacity-30">
          <Icon name="plus" size={15} />
        </button>
      </div>
    </div>
  )
}
