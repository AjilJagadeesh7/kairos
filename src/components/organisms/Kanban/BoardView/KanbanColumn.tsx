import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ColumnHeader } from './ColumnHeader'
import { TaskCard } from './TaskCard'
import { AddTaskInline } from './AddTaskInline'
import type { Board, KanbanColumn as KanbanColumnType, KanbanTask } from '../../../../types/kanban.types'

interface KanbanColumnProps {
  column: KanbanColumnType
  board: Board
  tasks: KanbanTask[]
  isFiltered: boolean
}

function EmptyDropIndicator({ isOver }: { isOver: boolean }) {
  return (
    <div
      className={`flex min-h-[80px] flex-1 items-center justify-center rounded-lg border-2 border-dashed text-xs text-[rgb(var(--text-3))] transition ${
        isOver ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5' : 'border-[rgb(var(--border))]'
      }`}
    >
      Drop here
    </div>
  )
}

export function KanbanColumn({ column, board, tasks, isFiltered }: KanbanColumnProps): JSX.Element {
  const sorted = [...tasks].sort((a, b) => a.order - b.order)

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: 'column', column },
  })

  const { setNodeRef: setBodyRef, isOver: isBodyOver } = useDroppable({
    id: `droppable-${column.id}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : (transition ? 'transform 220ms cubic-bezier(0.2, 0, 0, 1)' : undefined),
    opacity: isDragging ? 0.2 : 1,
  }

  return (
    <div
      ref={setSortableRef}
      style={style}
      className="group flex h-full w-[85vw] shrink-0 snap-start flex-col sm:w-auto sm:min-w-[220px] sm:flex-1"
    >
      <ColumnHeader
        column={column}
        board={board}
        taskCount={tasks.length}
        dragHandleProps={{ ...attributes, ...listeners }}
      />

      <div
        ref={setBodyRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-b-xl bg-[rgb(var(--surface-2))] p-2"
        style={{ borderTop: `3px solid ${column.color}` }}
      >
        <SortableContext items={sorted.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {sorted.map(task => (
            <TaskCard key={task.id} task={task} board={board} />
          ))}
        </SortableContext>

        {sorted.length === 0 && (
          <EmptyDropIndicator isOver={isBodyOver} />
        )}

        {isFiltered && tasks.length === 0 && sorted.length === 0 ? null : (
          <AddTaskInline boardId={board.id} columnId={column.id} />
        )}
      </div>
    </div>
  )
}
