import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useKanbanStore } from '../../../../../store/useKanbanStore'
import { IssueTypeIcon } from '../../../../atoms/IssueTypeIcon'
import { PriorityDot } from '../../../../atoms/PriorityDot'
import { DueDateChip } from '../../../../molecules/DueDateChip'
import type { Board, KanbanTask } from '../../../../../types/kanban.types'
import { Icon } from '../../../../../icons/Icon'

interface Props {
  task: KanbanTask
  board: Board
  overlay?: boolean
}

/** A single draggable backlog/sprint issue row. */
export function BacklogRow({ task, board, overlay = false }: Props): JSX.Element {
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { taskId: task.id },
  })
  const col = board.columns.find(c => c.id === task.columnId)
  const childCount = board.tasks.filter(t => t.parentId === task.id).length

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`flex items-center gap-2 rounded-md border bg-[rgb(var(--surface))] px-2 py-1.5 transition-[box-shadow,opacity] ${
        overlay ? 'cursor-grabbing border-[rgb(var(--border))] shadow-2xl ring-1 ring-black/5' : 'border-[rgb(var(--border))]'
      } ${isDragging && !overlay ? 'opacity-40' : ''}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]" title="Drag to a sprint">
        <Icon name="grip-vertical" size={13} />
      </button>
      <IssueTypeIcon type={task.type} size={15} />
      <span className="font-mono text-[10px] text-[rgb(var(--text-3))]">{task.key}</span>
      <button onClick={() => setActiveTaskId(task.id)} className="flex-1 truncate text-left text-xs text-[rgb(var(--text))] hover:underline">
        {task.title}
      </button>
      {childCount > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] text-[rgb(var(--text-3))]"><Icon name="git-fork" size={10} /> {childCount}</span>
      )}
      {task.due && <DueDateChip due={task.due} />}
      {task.priority && <PriorityDot priority={task.priority} size={7} />}
      {col && <span className="hidden shrink-0 rounded-full bg-[rgb(var(--surface-2))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--text-3))] sm:inline">{col.title}</span>}
    </div>
  )
}
