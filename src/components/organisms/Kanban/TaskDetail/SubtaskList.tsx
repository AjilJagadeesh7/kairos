import { useState } from 'react'

import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDndSensors } from '../../../../hooks/useDndSensors'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import type { KanbanTask, Subtask, Checkpoint } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface SubtaskListProps {
  boardId: string
  task: KanbanTask
}

function CheckpointRow({ cp, boardId, taskId, subtaskId }: {
  cp: Checkpoint
  boardId: string
  taskId: string
  subtaskId: string
}) {
  const toggleCheckpoint = useKanbanStore(s => s.toggleCheckpoint)
  const deleteCheckpoint = useKanbanStore(s => s.deleteCheckpoint)
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: cp.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-1.5 pl-4">
      <div {...attributes} {...listeners} className="cursor-grab text-[rgb(var(--text-3))] opacity-0 transition group-hover:opacity-100">
        <Icon name="grip-vertical" size={12} />
      </div>
      <button
        onClick={() => toggleCheckpoint(boardId, taskId, subtaskId, cp.id)}
        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
          cp.done
            ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))] text-[rgb(var(--accent-fg))]'
            : 'border-[rgb(var(--border))] hover:border-[rgb(var(--accent))]'
        }`}
      >
        {cp.done && <Icon name="check" size={10} strokeWidth={3} />}
      </button>
      <span className={`flex-1 text-xs ${cp.done ? 'text-[rgb(var(--text-3))] line-through' : 'text-[rgb(var(--text-2))]'}`}>
        {cp.label}
      </span>
      <button
        onClick={() => deleteCheckpoint(boardId, taskId, subtaskId, cp.id)}
        className="hidden text-[rgb(var(--text-3))] transition hover:text-red-500 group-hover:block"
      >
        <Icon name="trash-2" size={11} />
      </button>
    </div>
  )
}

function SubtaskRow({ sub, boardId, taskId }: { sub: Subtask; boardId: string; taskId: string }) {
  const [open, setOpen] = useState(false)
  const [addingCp, setAddingCp] = useState(false)
  const [cpLabel, setCpLabel] = useState('')
  const updateSubtask = useKanbanStore(s => s.updateSubtask)
  const deleteSubtask = useKanbanStore(s => s.deleteSubtask)
  const createCheckpoint = useKanbanStore(s => s.createCheckpoint)
  const reorderCheckpoints = useKanbanStore(s => s.reorderCheckpoints)
  const sensors = useDndSensors()

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sub.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const doneCps = sub.checkpoints.filter(c => c.done).length
  const totalCps = sub.checkpoints.length

  function handleCpKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const trimmed = cpLabel.trim()
      if (trimmed) { createCheckpoint(boardId, taskId, sub.id, trimmed); setCpLabel('') }
    }
    if (e.key === 'Escape') { setAddingCp(false); setCpLabel('') }
  }

  function handleCpDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = sub.checkpoints.sort((a, b) => a.order - b.order).map(c => c.id)
    const from = ids.indexOf(active.id as string)
    const to = ids.indexOf(over.id as string)
    if (from !== -1 && to !== -1) reorderCheckpoints(boardId, taskId, sub.id, arrayMove(ids, from, to))
  }

  return (
    <div ref={setNodeRef} style={style} className="group rounded-lg border border-transparent hover:border-[rgb(var(--border))]">
      <div className="flex items-center gap-1.5 p-1">
        <div {...attributes} {...listeners} className="cursor-grab text-[rgb(var(--text-3))] opacity-0 transition group-hover:opacity-100">
          <Icon name="grip-vertical" size={12} />
        </div>
        <button
          onClick={() => updateSubtask(boardId, taskId, sub.id, { done: !sub.done })}
          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
            sub.done
              ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))] text-[rgb(var(--accent-fg))]'
              : 'border-[rgb(var(--border))] hover:border-[rgb(var(--accent))]'
          }`}
        >
          {sub.done && <Icon name="check" size={10} strokeWidth={3} />}
        </button>
        <span className={`flex-1 text-sm ${sub.done ? 'text-[rgb(var(--text-3))] line-through' : 'text-[rgb(var(--text))]'}`}>
          {sub.title}
        </span>
        {totalCps > 0 && (
          <span className="text-xs text-[rgb(var(--text-3))]">{doneCps}/{totalCps}</span>
        )}
        <button
          onClick={() => setOpen(v => !v)}
          className="rounded p-0.5 text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]"
        >
          {open ? <Icon name="chevron-down" size={12} /> : <Icon name="chevron-right" size={12} />}
        </button>
        <button
          onClick={() => deleteSubtask(boardId, taskId, sub.id)}
          className="hidden rounded p-0.5 text-[rgb(var(--text-3))] hover:text-red-500 group-hover:block"
        >
          <Icon name="trash-2" size={12} />
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-1 pb-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCpDragEnd}>
            <SortableContext items={sub.checkpoints.sort((a, b) => a.order - b.order).map(c => c.id)} strategy={verticalListSortingStrategy}>
              {sub.checkpoints
                .sort((a, b) => a.order - b.order)
                .map(cp => (
                  <CheckpointRow key={cp.id} cp={cp} boardId={boardId} taskId={taskId} subtaskId={sub.id} />
                ))}
            </SortableContext>
          </DndContext>

          {addingCp ? (
            <input
              autoFocus
              value={cpLabel}
              onChange={e => setCpLabel(e.target.value)}
              onKeyDown={handleCpKeyDown}
              onBlur={() => { if (!cpLabel.trim()) setAddingCp(false) }}
              placeholder="Checkpoint label…"
              className="ml-6 rounded border border-[rgb(var(--accent))] bg-[rgb(var(--surface-2))] px-2 py-0.5 text-xs text-[rgb(var(--text))] outline-none"
            />
          ) : (
            <button
              onClick={() => setAddingCp(true)}
              className="ml-6 flex items-center gap-1 text-xs text-[rgb(var(--text-3))] hover:text-[rgb(var(--accent))]"
            >
              <Icon name="plus" size={11} /> Add checkpoint
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function SubtaskList({ boardId, task }: SubtaskListProps): JSX.Element {
  const [addingTitle, setAddingTitle] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const createSubtask = useKanbanStore(s => s.createSubtask)
  const reorderSubtasks = useKanbanStore(s => s.reorderSubtasks)
  const sensors = useDndSensors()

  const sorted = [...task.subtasks].sort((a, b) => a.order - b.order)

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const trimmed = addingTitle.trim()
      if (trimmed) { createSubtask(boardId, task.id, trimmed); setAddingTitle('') }
    }
    if (e.key === 'Escape') { setIsAdding(false); setAddingTitle('') }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = sorted.map(s => s.id)
    const from = ids.indexOf(active.id as string)
    const to = ids.indexOf(over.id as string)
    if (from !== -1 && to !== -1) reorderSubtasks(boardId, task.id, arrayMove(ids, from, to))
  }

  return (
    <div className="flex flex-col gap-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {sorted.map(sub => (
            <SubtaskRow key={sub.id} sub={sub} boardId={boardId} taskId={task.id} />
          ))}
        </SortableContext>
      </DndContext>

      {isAdding ? (
        <input
          autoFocus
          value={addingTitle}
          onChange={e => setAddingTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (!addingTitle.trim()) setIsAdding(false) }}
          placeholder="Subtask title…"
          className="rounded-lg border border-[rgb(var(--accent))] bg-[rgb(var(--surface-2))] px-2.5 py-1.5 text-sm text-[rgb(var(--text))] outline-none"
        />
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--accent))]"
        >
          <Icon name="plus" size={12} /> Add subtask
        </button>
      )}
    </div>
  )
}
