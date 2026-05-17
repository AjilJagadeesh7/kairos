import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { filterAndSortTasks } from '../../../../utils/kanban'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from './TaskCard'
import type { Board, KanbanColumn as ColType, KanbanTask } from '../../../../types/kanban.types'

interface DragData {
  type: 'task' | 'column'
  task?: KanbanTask
  column?: ColType
  columnId?: string
}

interface BoardColumnsProps {
  board: Board
}

export function BoardColumns({ board }: BoardColumnsProps): JSX.Element {
  const filters = useKanbanStore(s => s.filters)
  const reorderColumns = useKanbanStore(s => s.reorderColumns)
  const commitDragState = useKanbanStore(s => s.commitDragState)

  const [localTasks, setLocalTasks] = useState<KanbanTask[]>(board.tasks)
  const [localColumns, setLocalColumns] = useState<ColType[]>(board.columns)
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null)

  // Keep local state in sync when not dragging
  useEffect(() => {
    if (!activeDrag) {
      setLocalTasks(board.tasks)
      setLocalColumns(board.columns)
    }
  }, [board.tasks, board.columns, activeDrag])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const dropAnimation: DropAnimation = {
    duration: 320,
    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0.3' } },
    }),
  }

  const sortedColumns = [...localColumns].sort((a, b) => a.order - b.order)
  const isFiltered = filters.tags.length > 0 || filters.priorities.length > 0 || filters.due !== 'all' || !!filters.linkedNote

  function getColumnTasks(columnId: string): KanbanTask[] {
    const colTasks = localTasks.filter(t => t.columnId === columnId)
    return isFiltered ? filterAndSortTasks(colTasks, filters) : colTasks.sort((a, b) => a.order - b.order)
  }

  function handleDragStart({ active }: DragStartEvent) {
    const data = active.data.current as DragData | undefined
    if (!data) return
    setActiveDrag(data)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const activeData = active.data.current as DragData | undefined
    if (!activeData || activeData.type !== 'task' || !activeData.task) return

    const overId = over.id as string
    const overData = over.data.current as DragData | undefined

    // Determine target column
    let targetColumnId: string
    if (overData?.type === 'column') {
      targetColumnId = overData.column!.id
    } else if (overData?.type === 'task') {
      targetColumnId = overData.columnId!
    } else {
      // Dropped on droppable empty zone (id = `droppable-${columnId}`)
      const match = overId.match(/^droppable-(.+)$/)
      targetColumnId = match ? match[1] : activeData.task.columnId
    }

    const activeTaskId = active.id as string

    setLocalTasks(prev => {
      const activeTask = prev.find(t => t.id === activeTaskId)
      if (!activeTask) return prev

      // If crossing columns, just move the task over
      if (activeTask.columnId !== targetColumnId) {
        const updated = prev.map(t =>
          t.id === activeTaskId ? { ...t, columnId: targetColumnId } : t,
        )

        // Reorder within new column: place at end
        const newColTasks = updated.filter(t => t.columnId === targetColumnId).sort((a, b) => a.order - b.order)
        const withoutActive = newColTasks.filter(t => t.id !== activeTaskId)

        // If over a task in target column, insert before it
        if (overData?.type === 'task' && overData.columnId === targetColumnId) {
          const overIdx = withoutActive.findIndex(t => t.id === overId)
          if (overIdx !== -1) {
            withoutActive.splice(overIdx, 0, { ...activeTask, columnId: targetColumnId })
          } else {
            withoutActive.push({ ...activeTask, columnId: targetColumnId })
          }
        } else {
          withoutActive.push({ ...activeTask, columnId: targetColumnId })
        }

        const reordered = withoutActive.map((t, i) => ({ ...t, order: i + 1 }))
        return updated.map(t => {
          const r = reordered.find(rt => rt.id === t.id)
          return r ?? t
        })
      }

      // Same column: reorder
      if (overData?.type === 'task' && overData.columnId === targetColumnId) {
        const colTasks = prev.filter(t => t.columnId === targetColumnId).sort((a, b) => a.order - b.order)
        const fromIdx = colTasks.findIndex(t => t.id === activeTaskId)
        const toIdx = colTasks.findIndex(t => t.id === overId)
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev

        const reordered = arrayMove(colTasks, fromIdx, toIdx).map((t, i) => ({ ...t, order: i + 1 }))
        return prev.map(t => {
          const r = reordered.find(rt => rt.id === t.id)
          return r ?? t
        })
      }

      return prev
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const activeData = active.data.current as DragData | undefined
    setActiveDrag(null)

    if (!over || !activeData) return

    if (activeData.type === 'column') {
      const overData = over.data.current as DragData | undefined
      if (overData?.type === 'column') {
        const ids = sortedColumns.map(c => c.id)
        const from = ids.indexOf(active.id as string)
        const to = ids.indexOf(over.id as string)
        if (from !== -1 && to !== -1 && from !== to) {
          const newOrder = arrayMove(ids, from, to)
          setLocalColumns(cols => {
            const sorted = newOrder.map(id => cols.find(c => c.id === id)!).filter(Boolean).map((c, i) => ({ ...c, order: i + 1 }))
            return sorted
          })
          reorderColumns(board.id, newOrder)
        }
      }
      return
    }

    if (activeData.type === 'task') {
      // Commit the local tasks to the store
      commitDragState(board.id, localTasks, localColumns)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Columns fill the full width equally; horizontal scroll only if they overflow */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
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

      {/* Drag overlay */}
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
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: activeDrag.column.color }}
              />
              <span className="flex-1 truncate text-sm font-semibold text-[rgb(var(--text))]">
                {activeDrag.column.title}
              </span>
            </div>
            <div className="flex-1 rounded-b-xl bg-[rgb(var(--surface-2))] p-2" />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
