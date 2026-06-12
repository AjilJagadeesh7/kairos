import { useEffect, useState } from 'react'
import {
  defaultDropAnimationSideEffects,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core'
import { useDndSensors } from './useDndSensors'
import { arrayMove } from '@dnd-kit/sortable'
import { useKanbanStore } from '../store/useKanbanStore'
import { filterAndSortTasks } from '../utils/kanban'
import type { Board, KanbanColumn, KanbanTask } from '../types/kanban.types'

export interface DragData {
  type: 'task' | 'column'
  task?: KanbanTask
  column?: KanbanColumn
  columnId?: string
}

export function useBoardDragDrop(board: Board) {
  const filters         = useKanbanStore(s => s.filters)
  const reorderColumns  = useKanbanStore(s => s.reorderColumns)
  const commitDragState = useKanbanStore(s => s.commitDragState)

  const [localTasks,   setLocalTasks]   = useState<KanbanTask[]>(board.tasks)
  const [localColumns, setLocalColumns] = useState<KanbanColumn[]>(board.columns)
  const [activeDrag,   setActiveDrag]   = useState<DragData | null>(null)

  useEffect(() => {
    if (!activeDrag) {
      setLocalTasks(board.tasks)
      setLocalColumns(board.columns)
    }
  }, [board.tasks, board.columns, activeDrag])

  const sensors = useDndSensors()

  const dropAnimation: DropAnimation = {
    duration: 320,
    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0.3' } },
    }),
  }

  const sortedColumns = [...localColumns].sort((a, b) => a.order - b.order)
  const isFiltered    = filters.tags.length > 0 || filters.priorities.length > 0 || filters.due !== 'all' || !!filters.linkedNote

  function getColumnTasks(columnId: string): KanbanTask[] {
    const colTasks = localTasks.filter(t => t.columnId === columnId)
    return isFiltered ? filterAndSortTasks(colTasks, filters) : colTasks.sort((a, b) => a.order - b.order)
  }

  function handleDragStart({ active }: DragStartEvent) {
    const data = active.data.current as DragData | undefined
    if (data) setActiveDrag(data)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const activeData = active.data.current as DragData | undefined
    if (!activeData || activeData.type !== 'task' || !activeData.task) return

    const overId   = over.id as string
    const overData = over.data.current as DragData | undefined

    let targetColumnId: string
    if (overData?.type === 'column') {
      targetColumnId = overData.column!.id
    } else if (overData?.type === 'task') {
      targetColumnId = overData.columnId!
    } else {
      const match = overId.match(/^droppable-(.+)$/)
      targetColumnId = match ? match[1] : activeData.task.columnId
    }

    const activeTaskId = active.id as string

    setLocalTasks(prev => {
      const activeTask = prev.find(t => t.id === activeTaskId)
      if (!activeTask) return prev

      if (activeTask.columnId !== targetColumnId) {
        const updated = prev.map(t =>
          t.id === activeTaskId ? { ...t, columnId: targetColumnId } : t,
        )
        const newColTasks = updated.filter(t => t.columnId === targetColumnId).sort((a, b) => a.order - b.order)
        const withoutActive = newColTasks.filter(t => t.id !== activeTaskId)

        if (overData?.type === 'task' && overData.columnId === targetColumnId) {
          const overIdx = withoutActive.findIndex(t => t.id === overId)
          if (overIdx !== -1) withoutActive.splice(overIdx, 0, { ...activeTask, columnId: targetColumnId })
          else withoutActive.push({ ...activeTask, columnId: targetColumnId })
        } else {
          withoutActive.push({ ...activeTask, columnId: targetColumnId })
        }

        const reordered = withoutActive.map((t, i) => ({ ...t, order: i + 1 }))
        return updated.map(t => reordered.find(rt => rt.id === t.id) ?? t)
      }

      if (overData?.type === 'task' && overData.columnId === targetColumnId) {
        const colTasks = prev.filter(t => t.columnId === targetColumnId).sort((a, b) => a.order - b.order)
        const fromIdx = colTasks.findIndex(t => t.id === activeTaskId)
        const toIdx   = colTasks.findIndex(t => t.id === overId)
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev
        const reordered = arrayMove(colTasks, fromIdx, toIdx).map((t, i) => ({ ...t, order: i + 1 }))
        return prev.map(t => reordered.find(rt => rt.id === t.id) ?? t)
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
        const ids  = sortedColumns.map(c => c.id)
        const from = ids.indexOf(active.id as string)
        const to   = ids.indexOf(over.id as string)
        if (from !== -1 && to !== -1 && from !== to) {
          const newOrder = arrayMove(ids, from, to)
          setLocalColumns(cols =>
            newOrder
              .map(id => cols.find(c => c.id === id)!)
              .filter(Boolean)
              .map((c, i) => ({ ...c, order: i + 1 })),
          )
          reorderColumns(board.id, newOrder)
        }
      }
      return
    }

    if (activeData.type === 'task') {
      commitDragState(board.id, localTasks, localColumns)
    }
  }

  return {
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
  }
}
