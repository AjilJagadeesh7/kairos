import { useState } from 'react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { IssueTypeSelect } from './IssueTypeSelect'
import { IssueTypeIcon } from '../../../atoms/IssueTypeIcon'
import { PrioritySelect } from './PrioritySelect'
import { SprintSelect } from './SprintSelect'
import { DueDatePicker } from './DueDatePicker'
import { PARENT_ISSUE_TYPES, CHILD_ISSUE_TYPES, formatDate, tagTextColor } from '../../../../utils/kanban'
import type { Board, KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface Props {
  board: Board
  task: KanbanTask
  onOpen: (taskId: string) => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2 px-3 py-2">
      <span className="text-xs text-[rgb(var(--text-3))]">{label}</span>
      <div className="flex min-w-0 justify-start">{children}</div>
    </div>
  )
}

/** Jira-style "Details" panel: type, priority, parent, sprint, dates, labels. */
export function TaskDetailsSidebar({ board, task, onOpen }: Props): JSX.Element {
  const updateTask = useKanbanStore(s => s.updateTask)
  const [open, setOpen] = useState(true)
  const [tagInput, setTagInput] = useState('')
  const parent = task.parentId ? board.tasks.find(t => t.id === task.parentId) : null
  const iso = (d?: string) => (d ? d.split('T')[0] : undefined)

  function addTag() {
    const name = tagInput.trim()
    if (name && !task.tags.includes(name)) {
      updateTask(board.id, task.id, { tags: [...task.tags, name] })
      useKanbanStore.getState().addBoardTag(board.id, name)
    }
    setTagInput('')
  }
  function tagColor(name: string) {
    return board.boardTags.find(t => t.name === name)?.color ?? '#94a3b8'
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-1.5 border-b border-[rgb(var(--border))] px-3 py-2.5 text-left">
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} className="text-[rgb(var(--text-3))]" />
        <span className="text-sm font-semibold text-[rgb(var(--text))]">Details</span>
      </button>

      {open && (
        <div className="divide-y divide-[rgb(var(--border))]/50">
          <Row label="Type">
            <IssueTypeSelect value={task.type} options={task.parentId ? CHILD_ISSUE_TYPES : PARENT_ISSUE_TYPES} onChange={type => updateTask(board.id, task.id, { type })} />
          </Row>
          <Row label="Priority">
            <PrioritySelect value={task.priority} onChange={priority => updateTask(board.id, task.id, { priority })} />
          </Row>
          <Row label="Parent">
            {parent ? (
              <button onClick={() => onOpen(parent.id)} className="flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-xs text-[rgb(var(--accent))] hover:underline">
                <IssueTypeIcon type={parent.type} size={13} />
                <span className="truncate">{parent.key} {parent.title}</span>
              </button>
            ) : <span className="px-1 text-xs text-[rgb(var(--text-3))]">None</span>}
          </Row>
          <Row label="Sprint"><SprintSelect board={board} task={task} /></Row>
          <Row label="Start date">
            <DueDatePicker label="None" value={iso(task.startDate)} onChange={d => updateTask(board.id, task.id, { startDate: d ? `${d}T00:00:00.000Z` : undefined })} />
          </Row>
          <Row label="Due date">
            <DueDatePicker label="None" value={iso(task.due)} onChange={d => updateTask(board.id, task.id, { due: d ? `${d}T00:00:00.000Z` : undefined })} />
          </Row>
          <Row label="Labels">
            <div className="flex flex-wrap items-center gap-1">
              {task.tags.map(tag => {
                const bg = tagColor(tag)
                return (
                  <span key={tag} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: bg, color: tagTextColor(bg) }}>
                    {tag}
                    <button onClick={() => updateTask(board.id, task.id, { tags: task.tags.filter(t => t !== tag) })} className="opacity-70 hover:opacity-100"><Icon name="x" size={9} /></button>
                  </span>
                )
              })}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
                onBlur={addTag}
                placeholder="Add…"
                className="w-14 min-w-0 rounded bg-transparent px-1 py-0.5 text-[11px] text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))]"
              />
            </div>
          </Row>
        </div>
      )}

      <div className="border-t border-[rgb(var(--border))] px-3 py-2 text-[11px] text-[rgb(var(--text-3))]">
        <div>Created {formatDate(task.createdAt)}</div>
        <div>Updated {formatDate(task.updatedAt)}</div>
      </div>
    </div>
  )
}
