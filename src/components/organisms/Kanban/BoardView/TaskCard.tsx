
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { PriorityDot } from '../../../atoms/PriorityDot'
import { ProgressBar } from '../../../atoms/ProgressBar'
import { DueDateChip } from '../../../molecules/DueDateChip'
import { calcTaskProgress } from '../../../../utils/kanban'
import type { Board, KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface TaskCardProps {
  task: KanbanTask
  board: Board
  isOverlay?: boolean
}

export function TaskCard({ task, board, isOverlay = false }: TaskCardProps): JSX.Element {
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)
  const activeTaskId = useKanbanStore(s => s.activeTaskId)
  const isActive = activeTaskId === task.id

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task, columnId: task.columnId },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : (transition ? 'transform 220ms cubic-bezier(0.2, 0, 0, 1)' : undefined),
  }

  const progress = calcTaskProgress(task)
  const visibleTags = task.tags.slice(0, 3)
  const extraTags = task.tags.length - 3

  function getTagColor(name: string): string {
    return board.boardTags.find(t => t.name === name)?.color ?? '#94a3b8'
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setActiveTaskId(isActive ? null : task.id)}
      className={`
        cursor-pointer select-none rounded-lg border bg-[rgb(var(--surface))] p-3 shadow-sm
        transition-[box-shadow,border-color,opacity,background-color] duration-150
        hover:shadow-md
        ${isActive
          ? 'border-[rgb(var(--accent))]'
          : 'border-[rgb(var(--border))] hover:border-[rgb(var(--text-3))]'
        }
        ${isDragging && !isOverlay ? 'opacity-20 scale-[0.98]' : ''}
        ${isOverlay ? 'rotate-[1.5deg] scale-[1.03] shadow-2xl border-[rgb(var(--accent))]/40' : ''}
      `}
    >
      {/* Priority + title row */}
      <div className="flex items-start gap-2">
        {task.priority && (
          <div className="mt-1 flex-shrink-0">
            <PriorityDot priority={task.priority} size={7} />
          </div>
        )}
        <p className="line-clamp-2 text-sm font-medium leading-snug text-[rgb(var(--text))]">
          {task.title}
        </p>
      </div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleTags.map(tag => (
            <span
              key={tag}
              className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: getTagColor(tag) }}
            >
              {tag}
            </span>
          ))}
          {extraTags > 0 && (
            <span className="text-[10px] text-[rgb(var(--text-3))]">+{extraTags}</span>
          )}
        </div>
      )}

      {/* Due date */}
      {task.due && (
        <div className="mt-2">
          <DueDateChip due={task.due} />
        </div>
      )}

      {/* Progress bar */}
      {progress.total > 0 && (
        <div className="mt-2">
          <ProgressBar done={progress.done} total={progress.total} />
        </div>
      )}

      {/* Footer icons */}
      {(task.linkedNotes.length > 0 || task.linkedTasks.length > 0) && (
        <div className="mt-2 flex items-center gap-2">
          {task.linkedNotes.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-[rgb(var(--text-3))]">
              <Icon name="file-text" size={10} /> {task.linkedNotes.length}
            </span>
          )}
          {task.linkedTasks.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-[rgb(var(--text-3))]">
              <Icon name="link-2" size={10} /> {task.linkedTasks.length}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
