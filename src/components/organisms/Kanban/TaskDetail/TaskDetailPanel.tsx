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
import { IconButton } from '../../../atoms/IconButton'
import type { Board, KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface Props {
  task: KanbanTask
  board: Board
  onClose: () => void
}

export function TaskDetailPanel({ task, board, onClose }: Props): JSX.Element {
  const updateTask = useKanbanStore(s => s.updateTask)
  const [tagInput, setTagInput]   = useState('')
  const [addingTag, setAddingTag] = useState(false)

  const progress = calcTaskProgress(task)

  function commitTag() {
    const name = tagInput.trim().replace(/^,/, '')
    if (name && !task.tags.includes(name)) {
      updateTask(board.id, task.id, { tags: [...task.tags, name] })
      useKanbanStore.getState().addBoardTag(board.id, name)
    }
    setTagInput('')
    setAddingTag(false)
  }

  function addTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTag() }
    if (e.key === 'Escape') { setTagInput(''); setAddingTag(false) }
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
          {/* Mobile: the drawer is full-screen, so give it an explicit back affordance */}
          <IconButton icon="arrow-left" label="Back" size="md" className="-ml-2 md:hidden" onClick={onClose} />
          {progress.total > 0 && (
            <ProgressBar done={progress.done} total={progress.total} className="w-24" />
          )}
        </div>
        <IconButton icon="x" label="Close" size="md" className="hidden md:flex" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <TaskTitleEditor boardId={board.id} taskId={task.id} title={task.title} />
        <TaskMetaRow task={task} board={board} />

        <TaskDescriptionEditor boardId={board.id} task={task} />

        <section className="mb-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
            <Icon name="tag" size={12} /> Tags
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {task.tags.map(tag => {
              const bg = getTagColor(tag)
              const fg = tagTextColor(bg)
              return (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: bg, color: fg }}
                >
                  <Icon name="hash" size={9} strokeWidth={2.5} />
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 flex items-center justify-center opacity-60 transition hover:opacity-100"
                    style={{ color: 'inherit' }}
                  >
                    <Icon name="x" size={10} />
                  </button>
                </span>
              )
            })}
            {addingTag ? (
              <input
                autoFocus
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={addTag}
                onBlur={commitTag}
                placeholder="Tag name…"
                className="min-w-[80px] rounded-full border border-dashed border-[rgb(var(--border))] bg-transparent px-2.5 py-0.5 text-[11px] text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))]"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingTag(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-[rgb(var(--border))] px-2 py-0.5 text-[11px] text-[rgb(var(--text-3))] transition hover:border-[rgb(var(--text-3))] hover:text-[rgb(var(--text-2))]"
              >
                <Icon name="plus" size={10} /> Add tag
              </button>
            )}
          </div>
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
