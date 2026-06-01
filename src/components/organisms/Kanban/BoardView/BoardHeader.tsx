import { useState } from 'react'

import { useNavigate } from 'react-router-dom'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { Button } from '../../../atoms/Button'
import { Select } from '../../../atoms/Select'
import { AddColumnModal } from './AddColumnModal'
import type { Board, DueFilter, Priority } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'
import { SlotRenderer } from '../../../molecules/SlotRenderer'

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']
const PRIORITY_LABELS: Record<Priority, string> = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }
const DUE_OPTIONS: Array<{ value: DueFilter; label: string }> = [
  { value: 'all',     label: 'All dates'     },
  { value: 'overdue', label: 'Overdue'       },
  { value: 'today',   label: 'Due today'     },
  { value: 'week',    label: 'Due this week' },
]

interface BoardHeaderProps {
  board: Board
  onOpenSettings: () => void
}

export function BoardHeader({ board, onOpenSettings }: BoardHeaderProps): JSX.Element {
  const navigate = useNavigate()
  const undo         = useKanbanStore(s => s.undo)
  const redo         = useKanbanStore(s => s.redo)
  const history      = useKanbanStore(s => s.history)
  const createColumn = useKanbanStore(s => s.createColumn)
  const setBoardNoSync = useKanbanStore(s => s.setBoardNoSync)
  const filters      = useKanbanStore(s => s.filters)
  const setFilters   = useKanbanStore(s => s.setFilters)
  const clearFilters = useKanbanStore(s => s.clearFilters)

  const bh      = history[board.id]
  const canUndo = (bh?.past.length   ?? 0) > 0
  const canRedo = (bh?.future.length ?? 0) > 0

  const [showAddCol, setShowAddCol] = useState(false)

  const hasFilters =
    filters.priorities.length > 0 || filters.tags.length > 0 ||
    filters.due !== 'all' || filters.linkedNote !== null

  function togglePriority(p: Priority) {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter(x => x !== p)
      : [...filters.priorities, p]
    setFilters({ priorities: next })
  }

  function handleAddColumn(name: string, color: string) {
    createColumn(board.id, name, color)
    setShowAddCol(false)
  }

  return (
    <>
    <div className="flex flex-shrink-0 items-center gap-2 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2">

      {/* ── Back + title ─────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/kanban')}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
      >
        <Icon name="arrow-left" size={13} /> Boards
      </button>

      <div className="h-4 w-px bg-[rgb(var(--border))]" />

      <span className="max-w-[160px] truncate text-sm font-bold text-[rgb(var(--text))]">
        {board.title}
      </span>

      <div className="h-4 w-px bg-[rgb(var(--border))]" />

      {/* ── Filters (priority pills + due date) ──────────────────── */}
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {PRIORITIES.map(p => (
          <button
            key={p}
            onClick={() => togglePriority(p)}
            className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium transition ${
              filters.priorities.includes(p)
                ? 'bg-[rgb(var(--surface-3))] text-[rgb(var(--text))]'
                : 'text-[rgb(var(--text-3))] hover:text-[rgb(var(--text-2))]'
            }`}
          >
            {PRIORITY_LABELS[p]}
          </button>
        ))}

        <Select<DueFilter>
          value={filters.due}
          options={DUE_OPTIONS}
          onChange={due => setFilters({ due })}
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-[rgb(var(--text-3))] hover:text-red-400"
          >
            <Icon name="x" size={10} /> Clear
          </button>
        )}
      </div>

      {/* ── Right actions ────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <div className="mx-1 h-4 w-px bg-[rgb(var(--border))]" />

        {/* Add column */}
        <Button variant="ghost" size="xs" onClick={() => setShowAddCol(true)}
          className="inline-flex items-center gap-1 text-xs">
          <Icon name="plus" size={12} /> Add column
        </Button>

        <div className="mx-1 h-4 w-px bg-[rgb(var(--border))]" />

        <Button variant="ghost" size="xs" onClick={() => undo(board.id)}
          disabled={!canUndo} title="Undo (Ctrl+Z)"
          className="h-6 w-6 p-0 disabled:opacity-30">
          <Icon name="undo-2" size={12} />
        </Button>
        <Button variant="ghost" size="xs" onClick={() => redo(board.id)}
          disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
          className="h-6 w-6 p-0 disabled:opacity-30">
          <Icon name="redo-2" size={12} />
        </Button>

        <div className="mx-1 h-4 w-px bg-[rgb(var(--border))]" />

        {/* Sync this board (opt out keeps it local-only) */}
        <button type="button"
          onClick={() => setBoardNoSync(board.id, !board.noSync)}
          title={board.noSync ? 'Local only — click to sync this board' : "Don't sync this board"}
          aria-pressed={!!board.noSync}
          className={`flex h-6 w-6 items-center justify-center rounded transition ${
            board.noSync
              ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
              : 'text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]'
          }`}
        >
          <Icon name={board.noSync ? 'cloud-off' : 'cloud'} size={12} />
        </button>

        <Button variant="ghost" size="xs" onClick={onOpenSettings}
          className="inline-flex items-center gap-1 text-xs">
          <Icon name="settings" size={12} /> Settings
        </Button>
        <SlotRenderer slot="kanban:toolbar:end" props={{ boardId: board.id }} className="flex items-center" />
      </div>
    </div>

    {showAddCol && (
      <AddColumnModal
        onConfirm={handleAddColumn}
        onClose={() => setShowAddCol(false)}
        defaultColor={undefined}
      />
    )}
    </>
  )
}
