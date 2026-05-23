
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { PriorityDot } from '../../../atoms/PriorityDot'
import { ProgressBar } from '../../../atoms/ProgressBar'
import { DueDateChip } from '../../../molecules/DueDateChip'
import { calcTaskProgress, tagTextColor } from '../../../../utils/kanban'
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

  const colColor = board.columns.find(c => c.id === task.columnId)?.color

  const hasFooter = task.due || progress.total > 0 || task.linkedNotes.length > 0 || task.linkedTasks.length > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setActiveTaskId(isActive ? null : task.id)}
      className={`
        group relative cursor-pointer select-none overflow-hidden rounded-lg border
        bg-[rgb(var(--surface))] shadow-sm
        transition-[box-shadow,border-color,opacity] duration-150
        hover:shadow-md
        ${isActive
          ? 'border-[rgb(var(--accent))]'
          : 'border-[rgb(var(--border))] hover:border-[rgb(var(--text-3))]'
        }
        ${isDragging && !isOverlay ? 'opacity-20 scale-[0.98]' : ''}
        ${isOverlay ? 'rotate-[1.5deg] scale-[1.03] shadow-2xl' : ''}
      `}
    >
      {/* Left accent strip */}
      {colColor && (
        <span
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ backgroundColor: colColor }}
        />
      )}

      <div className="px-3 py-2.5" style={{ paddingLeft: colColor ? '14px' : undefined }}>
        {/* Title + priority */}
        <div className="flex items-start gap-1.5">
          {task.priority && (
            <div className="mt-[3px] shrink-0">
              <PriorityDot priority={task.priority} size={6} />
            </div>
          )}
          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[rgb(var(--text))]">
            {task.title}
          </p>
        </div>

        {/* Tags */}
        {visibleTags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {visibleTags.map(tag => (
              <span
                key={tag}
                className="inline-block rounded-full px-1.5 py-px text-[10px] font-medium"
                style={{ backgroundColor: getTagColor(tag), color: tagTextColor(getTagColor(tag)) }}
              >
                {tag}
              </span>
            ))}
            {extraTags > 0 && (
              <span className="text-[10px] text-[rgb(var(--text-3))]">+{extraTags}</span>
            )}
          </div>
        )}

        {/* Progress bar */}
        {progress.total > 0 && (
          <div className="mt-2">
            <ProgressBar done={progress.done} total={progress.total} />
          </div>
        )}

        {/* Footer: due + linked counts — single row */}
        {hasFooter && (
          <div className="mt-1.5 flex items-center gap-2.5">
            {task.due && <DueDateChip due={task.due} />}
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
    </div>
  )
}
