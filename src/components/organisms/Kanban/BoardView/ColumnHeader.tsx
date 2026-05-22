import { useEffect, useRef, useState } from 'react'

import { useKanbanStore } from '../../../../store/useKanbanStore'
import { ColorPicker } from '../../../molecules/ColorPicker'
import type { Board, KanbanColumn } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

const PALETTE = [
  // Reds / pinks
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  // Greens
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  // Blues
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  // Purples / pinks
  '#a855f7', '#ec4899', '#f43f5e', '#64748b',
]

interface ColumnHeaderProps {
  column: KanbanColumn
  board: Board
  taskCount: number
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function ColumnHeader({ column, board, taskCount, dragHandleProps }: ColumnHeaderProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(column.title)
  const [showColors, setShowColors] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const colorRef = useRef<HTMLDivElement>(null)
  const updateColumn = useKanbanStore(s => s.updateColumn)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  // Close color picker on outside click
  useEffect(() => {
    if (!showColors) return
    function onClickOutside(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColors(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showColors])

  function handleRename() {
    const trimmed = title.trim()
    if (trimmed && trimmed !== column.title) {
      updateColumn(board.id, column.id, { title: trimmed })
    } else {
      setTitle(column.title)
    }
    setEditing(false)
  }

  const isOverWip = column.wipLimit !== undefined && taskCount > column.wipLimit

  return (
    <div className="flex items-center gap-1.5 px-1 pb-2">
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        className="flex-shrink-0 cursor-grab text-[rgb(var(--text-3))] opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
      >
        <Icon name="grip-vertical" size={14} />
      </div>

      {/* Clickable color dot */}
      <div className="relative flex-shrink-0" ref={colorRef}>
        <button
          onClick={() => setShowColors(v => !v)}
          className="h-3 w-3 rounded-full ring-2 ring-transparent transition hover:ring-white/40"
          style={{ backgroundColor: column.color }}
          title="Change color"
        />
        {showColors && (
          <div className="absolute left-0 top-full z-30 mt-2 w-48 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 shadow-xl">
            <ColorPicker
              value={column.color}
              onChange={color => { updateColumn(board.id, column.id, { color }); setShowColors(false) }}
              palette={PALETTE}
              cols={4}
            />
          </div>
        )}
      </div>

      {/* Title — click to edit inline */}
      {editing ? (
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={e => {
            if (e.key === 'Enter') handleRename()
            if (e.key === 'Escape') { setTitle(column.title); setEditing(false) }
          }}
          className="flex-1 rounded bg-[rgb(var(--surface-2))] px-1.5 py-0.5 text-sm font-semibold text-[rgb(var(--text))] outline-none focus:ring-1 focus:ring-[rgb(var(--accent))]"
        />
      ) : (
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'F2') setEditing(true) }}
          className="flex-1 cursor-text truncate text-sm font-semibold text-[rgb(var(--text))] hover:text-[rgb(var(--accent))]"
          title="Click to rename"
        >
          {column.title}
        </span>
      )}

      {/* Task count + WIP */}
      <span
        className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
          isOverWip
            ? 'border border-yellow-400 bg-yellow-400/10 text-yellow-500'
            : 'bg-[rgb(var(--surface-2))] text-[rgb(var(--text-3))]'
        }`}
      >
        {taskCount}
        {column.wipLimit !== undefined && ` / ${column.wipLimit}`}
      </span>
    </div>
  )
}
