import { useState } from 'react'

import { useKanbanStore } from '../../../../store/useKanbanStore'
import { ProgressBar } from '../../../atoms/ProgressBar'
import { SubtaskList } from './SubtaskList'
import { LinkedNotes } from './LinkedNotes'
import { LinkedTasks } from './LinkedTasks'
import { TaskDescriptionEditor } from './TaskDescriptionEditor'
import { TaskComments } from './TaskComments'
import { TaskAttachments } from './TaskAttachments'
import { TaskTitleEditor } from './TaskTitleEditor'
import { TaskMetaRow } from './TaskMetaRow'
import { calcTaskProgress, formatDate, tagTextColor } from '../../../../utils/kanban'
import type { Board, KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface Props {
  task: KanbanTask
  board: Board
  onClose: () => void
}

export function TaskDetailPanel({ task, board, onClose }: Props): JSX.Element {
  const updateTask = useKanbanStore(s => s.updateTask)
  const [tagInput, setTagInput] = useState('')

  const progress = calcTaskProgress(task)

  function addTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const name = tagInput.trim().replace(/^,/, '')
      if (!name || task.tags.includes(name)) { setTagInput(''); return }
      updateTask(board.id, task.id, { tags: [...task.tags, name] })
      useKanbanStore.getState().addBoardTag(board.id, name)
      setTagInput('')
    }
    if (e.key === 'Backspace' && !tagInput && task.tags.length > 0) {
      updateTask(board.id, task.id, { tags: task.tags.slice(0, -1) })
    }
  }

  function removeTag(tag: string) {
    updateTask(board.id, task.id, { tags: task.tags.filter(t => t !== tag) })
  }

  function getTagColor(name: string): string {
    return board.boardTags.find(t => t.name === name)?.color ?? '#94a3b8'
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[rgb(var(--surface))]">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[rgb(var(--border))] px-4 py-3">
        <div className="flex items-center gap-2">
          {progress.total > 0 && (
            <ProgressBar done={progress.done} total={progress.total} className="w-24" />
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <TaskTitleEditor boardId={board.id} taskId={task.id} title={task.title} />
        <TaskMetaRow task={task} board={board} />

        <TaskDescriptionEditor boardId={board.id} task={task} />

        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">Tags</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {task.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ backgroundColor: getTagColor(tag), color: tagTextColor(getTagColor(tag)) }}
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="ml-0.5 opacity-70 hover:opacity-100 leading-none">×</button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={addTag}
              placeholder="Add tag…"
              className="min-w-[72px] flex-1 bg-transparent text-sm text-[rgb(var(--text))] outline-none placeholder-[rgb(var(--text-3))]"
            />
          </div>
          <p className="mt-1.5 text-[10px] text-[rgb(var(--text-3))]">Enter or comma to add</p>
        </section>

        <TaskAttachments boardId={board.id} task={task} />

        <section className="mb-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
            <Icon name="list" size={12} /> Subtasks
          </h3>
          <SubtaskList boardId={board.id} task={task} />
        </section>

        <section className="mb-5">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
            <Icon name="file-text" size={12} /> Linked Notes
            {(task.linkedNotes.length > 0) && (
              <span className="ml-1 font-normal normal-case text-[rgb(var(--text-3))]">({task.linkedNotes.length})</span>
            )}
          </h3>
          <LinkedNotes boardId={board.id} task={task} />
        </section>

        <section className="mb-5">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
            <Icon name="link-2" size={12} /> Linked Tasks
            {(task.linkedTasks.length > 0) && (
              <span className="ml-1 font-normal normal-case text-[rgb(var(--text-3))]">({task.linkedTasks.length})</span>
            )}
          </h3>
          <LinkedTasks boardId={board.id} board={board} task={task} />
        </section>

        <TaskComments boardId={board.id} task={task} />

        <p className="mt-2 pb-4 text-xs text-[rgb(var(--text-3))]">
          Created {formatDate(task.createdAt)}
        </p>
      </div>
    </div>
  )
}
