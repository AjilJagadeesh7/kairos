import { DndContext, DragOverlay, closestCorners, pointerWithin, type CollisionDetection } from '@dnd-kit/core'

// pointerWithin is reliable for large zones (empty columns); fall back to
// closestCorners for edge cases where the pointer is between elements.
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : closestCorners(args)
}
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useBoardDragDrop } from '../../../../hooks/useBoardDragDrop'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from './TaskCard'
import type { Board } from '../../../../types/kanban.types'

interface Props {
  board: Board
}

export function BoardColumns({ board }: Props): JSX.Element {
  const {
    localTasks,
    localColumns,
    sortedColumns,
    activeDrag,
    sensors,
    dropAnimation,
    isFiltered,
    getColumnTasks,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useBoardDragDrop(board)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-pl-4 scroll-smooth">
        <div className="flex h-full min-w-full gap-3 p-4">
          <SortableContext items={sortedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {sortedColumns.map(col => (
              <KanbanColumn
                key={col.id}
                column={col}
                board={{ ...board, tasks: localTasks, columns: localColumns }}
                tasks={getColumnTasks(col.id)}
                isFiltered={isFiltered}
              />
            ))}
          </SortableContext>
        </div>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeDrag?.type === 'task' && activeDrag.task && (
          <div className="w-72">
            <TaskCard task={activeDrag.task} board={board} isOverlay />
          </div>
        )}
        {activeDrag?.type === 'column' && activeDrag.column && (
          <div
            className="flex h-full min-w-[220px] flex-1 flex-col rounded-xl opacity-90 shadow-2xl ring-2 ring-[rgb(var(--accent))]/30"
            style={{ borderTop: `3px solid ${activeDrag.column.color}` }}
          >
            <div className="flex items-center gap-2 rounded-t-xl bg-[rgb(var(--surface))] px-3 py-2">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: activeDrag.column.color }} />
              <span className="flex-1 truncate text-sm font-semibold text-[rgb(var(--text))]">{activeDrag.column.title}</span>
            </div>
            <div className="flex-1 rounded-b-xl bg-[rgb(var(--surface-2))] p-2" />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
