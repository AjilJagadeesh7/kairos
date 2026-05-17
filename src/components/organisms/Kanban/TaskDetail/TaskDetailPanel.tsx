import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronDown, FileText, Link2, List, Trash2, X } from 'lucide-react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { useConfirmStore } from '../../../../store/useConfirmStore'
import { PriorityDot } from '../../../atoms/PriorityDot'
import { ProgressBar } from '../../../atoms/ProgressBar'
import { SubtaskList } from './SubtaskList'
import { LinkedNotes } from './LinkedNotes'
import { LinkedTasks } from './LinkedTasks'
import { TaskDescriptionEditor } from './TaskDescriptionEditor'
import { TaskComments } from './TaskComments'
import { TaskAttachments } from './TaskAttachments'
import { calcTaskProgress, formatDate, PRIORITY_COLORS } from '../../../../utils/kanban'
import type { Board, KanbanTask, Priority } from '../../../../types/kanban.types'

const PRIORITIES: Array<Priority | null> = [null, 'low', 'medium', 'high', 'urgent']
const PRIORITY_LABELS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }

interface TaskDetailPanelProps {
  task: KanbanTask
  board: Board
  onClose: () => void
}

export function TaskDetailPanel({ task, board, onClose }: TaskDetailPanelProps): JSX.Element {
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  const updateTask = useKanbanStore(s => s.updateTask)
  const deleteTask = useKanbanStore(s => s.deleteTask)
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)

  // Sync local state when task changes (e.g. from external update)
  useEffect(() => {
    setTitle(task.title)
  }, [task.id, task.title])

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus()
  }, [editingTitle])

  function saveTitle() {
    const trimmed = title.trim()
    if (trimmed && trimmed !== task.title) updateTask(board.id, task.id, { title: trimmed })
    else setTitle(task.title)
    setEditingTitle(false)
  }

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

  function addTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const name = tagInput.trim().replace(/^,/, '')
      if (!name || task.tags.includes(name)) { setTagInput(''); return }
      updateTask(board.id, task.id, { tags: [...task.tags, name] })
      // also register board-level tag if new
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

  const sortedColumns = [...board.columns].sort((a, b) => a.order - b.order)
  const currentColumn = board.columns.find(c => c.id === task.columnId)
  const progress = calcTaskProgress(task)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[rgb(var(--surface))]">
      {/* Header */}
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
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Title */}
        {editingTitle ? (
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(task.title); setEditingTitle(false) } }}
            className="mb-4 w-full rounded-lg border border-[rgb(var(--accent))] bg-[rgb(var(--surface-2))] px-3 py-2 text-lg font-semibold text-[rgb(var(--text))] outline-none"
          />
        ) : (
          <h2
            className="mb-4 cursor-text text-lg font-semibold leading-snug text-[rgb(var(--text))] hover:text-[rgb(var(--accent))]"
            onClick={() => setEditingTitle(true)}
          >
            {task.title}
          </h2>
        )}

        {/* Column + Priority row */}
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

        {/* Description */}
        <TaskDescriptionEditor boardId={board.id} task={task} />

        {/* Tags */}
        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">Tags</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {task.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: getTagColor(tag) }}
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 opacity-70 hover:opacity-100 leading-none"
                >
                  ×
                </button>
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

        {/* Attachments */}
        <TaskAttachments boardId={board.id} task={task} />

        {/* Subtasks */}
        <section className="mb-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
            <List size={12} /> Subtasks
          </h3>
          <SubtaskList boardId={board.id} task={task} />
        </section>

        {/* Linked Notes */}
        <section className="mb-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
            <FileText size={12} /> Linked Notes
          </h3>
          <LinkedNotes boardId={board.id} task={task} />
        </section>

        {/* Linked Tasks */}
        <section className="mb-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
            <Link2 size={12} /> Linked Tasks
          </h3>
          <LinkedTasks boardId={board.id} board={board} task={task} />
        </section>

        {/* Comments — last section */}
        <TaskComments boardId={board.id} task={task} />

        <p className="mt-2 pb-4 text-xs text-[rgb(var(--text-3))]">
          Created {formatDate(task.createdAt)}
        </p>
      </div>
    </div>
  )
}
