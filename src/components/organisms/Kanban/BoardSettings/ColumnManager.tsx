import { useState } from 'react'

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { useDndSensors } from '../../../../hooks/useDndSensors'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { useConfirmStore } from '../../../../store/useConfirmStore'
import { ColorPicker } from '../../../molecules/ColorPicker'
import { AddColumnModal } from '../BoardView/AddColumnModal'
import { DEFAULT_COLUMN_COLORS } from '../../../../utils/kanban'
import type { Board, KanbanColumn } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface ColumnRowProps {
  column: KanbanColumn
  board: Board
}

function ColumnRow({ column, board }: ColumnRowProps): JSX.Element {
  const [editTitle, setEditTitle] = useState(column.title)
  const [showColors, setShowColors] = useState(false)
  const updateColumn = useKanbanStore(s => s.updateColumn)
  const deleteColumn = useKanbanStore(s => s.deleteColumn)

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: column.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  function handleRename() {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== column.title) updateColumn(board.id, column.id, { title: trimmed })
  }

  function handleDelete() {
    const others = board.columns.filter(c => c.id !== column.id)
    const tasksInCol = board.tasks.filter(t => t.columnId === column.id)

    if (tasksInCol.length === 0) { deleteColumn(board.id, column.id); return }

    void useConfirmStore.getState().confirm({
      title: `Delete "${column.title}"?`,
      message: `${tasksInCol.length} task${tasksInCol.length !== 1 ? 's' : ''} will be ${others.length > 0 ? 'moved to the first column' : 'deleted'}.`,
      confirmLabel: 'Delete',
      danger: true,
    }).then(confirmed => {
      if (confirmed) deleteColumn(board.id, column.id, others[0]?.id)
    })
  }

  return (
    <div ref={setNodeRef} style={style} className="group flex flex-col gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3">
      <div className="flex items-center gap-2">
        <div {...attributes} {...listeners} className="cursor-grab text-[rgb(var(--text-3))]">
          <Icon name="grip-vertical" size={14} />
        </div>
        <button
          className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-white/20"
          style={{ backgroundColor: column.color }}
          onClick={() => setShowColors(v => !v)}
          title="Change color"
        />
        <input
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={e => e.key === 'Enter' && handleRename()}
          className="flex-1 rounded bg-transparent px-1 text-sm font-medium text-[rgb(var(--text))] outline-none focus:bg-[rgb(var(--surface))] focus:ring-1 focus:ring-[rgb(var(--accent))]"
        />
        <button
          onClick={handleDelete}
          className="text-[rgb(var(--text-3))] opacity-0 transition hover:text-red-500 group-hover:opacity-100"
        >
          <Icon name="trash-2" size={14} />
        </button>
      </div>
      {showColors && (
        <ColorPicker
          value={column.color}
          onChange={color => { updateColumn(board.id, column.id, { color }); setShowColors(false) }}
          palette={[
            '#ef4444', '#f97316', '#f59e0b', '#eab308',
            '#84cc16', '#22c55e', '#10b981', '#14b8a6',
            '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
            '#a855f7', '#ec4899', '#f43f5e', '#64748b',
          ]}
          cols={8}
        />
      )}
    </div>
  )
}

interface ColumnManagerProps {
  board: Board
}

export function ColumnManager({ board }: ColumnManagerProps): JSX.Element {
  const [showModal, setShowModal] = useState(false)
  const createColumn = useKanbanStore(s => s.createColumn)
  const reorderColumns = useKanbanStore(s => s.reorderColumns)
  const sensors = useDndSensors()

  const sorted = [...board.columns].sort((a, b) => a.order - b.order)

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = sorted.map(c => c.id)
    const from = ids.indexOf(active.id as string)
    const to = ids.indexOf(over.id as string)
    if (from !== -1 && to !== -1) reorderColumns(board.id, arrayMove(ids, from, to))
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {sorted.map(col => (
              <ColumnRow key={col.id} column={col} board={board} />
            ))}
          </SortableContext>
        </DndContext>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[rgb(var(--border))] py-2 text-sm text-[rgb(var(--text-3))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]"
        >
          <Icon name="plus" size={14} /> Add column
        </button>
      </div>

      {showModal && (
        <AddColumnModal
          onConfirm={(name, color) => {
            createColumn(board.id, name, color)
            setShowModal(false)
          }}
          onClose={() => setShowModal(false)}
          defaultColor={DEFAULT_COLUMN_COLORS[board.columns.length % DEFAULT_COLUMN_COLORS.length]}
        />
      )}
    </>
  )
}
