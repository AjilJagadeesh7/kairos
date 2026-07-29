import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { IssueTypeIcon } from '../../../atoms/IssueTypeIcon'
import { PriorityDot } from '../../../atoms/PriorityDot'
import { ProgressBar } from '../../../atoms/ProgressBar'
import { DueDateChip } from '../../../molecules/DueDateChip'
import { calcChildProgress, isTaskOverdue } from '../../../../utils/kanban'
import type { Board, KanbanTask } from '../../../../types/kanban.types'

interface Props {
  task: KanbanTask
  board: Board
  overlay?: boolean
}

/** Compact, draggable card used inside grouped swimlanes. */
export function SwimlaneCard({ task, board, overlay = false }: Props): JSX.Element {
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { taskId: task.id },
  })
  const progress = calcChildProgress(task, board)
  const colColor = board.columns.find(c => c.id === task.columnId)?.color
  const overdue  = isTaskOverdue(task, board)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      onClick={() => setActiveTaskId(task.id)}
      className={`group relative cursor-pointer select-none overflow-hidden rounded-lg border bg-[rgb(var(--surface))] px-3 py-2.5 shadow-sm transition-[box-shadow,border-color,opacity] hover:border-[rgb(var(--text-3))] ${
        overlay
          ? 'cursor-grabbing border-[rgb(var(--border))] shadow-2xl ring-1 ring-black/5'
          : overdue ? 'border-red-500/60 ring-1 ring-inset ring-red-500/25' : 'border-[rgb(var(--border))]'
      } ${isDragging && !overlay ? 'border-dashed border-[rgb(var(--accent))]/60 bg-[rgb(var(--accent))]/5 opacity-60 [&>*]:invisible' : ''}`}
    >
      {colColor && <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: colColor }} />}
      <div className="flex items-start gap-1.5" style={{ paddingLeft: colColor ? 4 : 0 }}>
        <div className="mt-[1px] shrink-0"><IssueTypeIcon type={task.type} size={15} /></div>
        {task.priority && <div className="mt-[3px] shrink-0"><PriorityDot priority={task.priority} size={6} /></div>}
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[rgb(var(--text))]">{task.title}</p>
      </div>
      {progress.total > 0 && <div className="mt-2"><ProgressBar done={progress.done} total={progress.total} /></div>}
      <div className="mt-1.5 flex items-center gap-2.5" style={{ paddingLeft: colColor ? 4 : 0 }}>
        <span className="font-mono text-[10px] font-medium text-[rgb(var(--text-3))]">{task.key}</span>
        {task.due && <DueDateChip due={task.due} />}
      </div>
    </div>
  )
}
