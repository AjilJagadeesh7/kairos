import { useState } from 'react'

import { useNavigate } from 'react-router-dom'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { Button } from '../../../atoms/Button'
import { Select } from '../../../atoms/Select'
import { Dropdown } from '../../../molecules/Dropdown'
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

const overflowItemCls = 'flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))] disabled:opacity-30'

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
    <div className="touch-compact flex flex-shrink-0 items-center gap-1.5 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 py-2 md:gap-2 md:px-3">

      {/* ── Back + title ─────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/kanban')}
        className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
      >
        <Icon name="arrow-left" size={13} /> <span className="hidden md:inline">Boards</span>
      </button>

      <div className="hidden h-4 w-px bg-[rgb(var(--border))] md:block" />

      <span className="max-w-[120px] truncate text-sm font-bold text-[rgb(var(--text))] md:max-w-[160px]">
        {board.title}
      </span>

      <div className="h-4 w-px bg-[rgb(var(--border))]" />

      {/* ── Filters (priority pills + due date) — inline on desktop ─ */}
      <div className="hidden flex-1 items-center gap-1 overflow-x-auto md:flex">
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

      {/* Mobile: push actions right + collapse filters into a dropdown */}
      <div className="flex-1 md:hidden" />
      <div className="md:hidden">
        <Dropdown trigger={
          <div className="relative flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]">
            <Icon name="list" size={13} />
            <Icon name="chevron-down" size={10} />
            {hasFilters && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" />}
          </div>
        }>
          <div className="w-56 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--text-3))]">Priority</div>
            <div className="mb-2 flex flex-wrap gap-1">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  onClick={() => togglePriority(p)}
                  className={`whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium transition ${
                    filters.priorities.includes(p)
                      ? 'bg-[rgb(var(--surface-3))] text-[rgb(var(--text))]'
                      : 'text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-2))]'
                  }`}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--text-3))]">Due date</div>
            <div className="mb-1 flex flex-wrap gap-1">
              {DUE_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setFilters({ due: o.value })}
                  className={`whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium transition ${
                    filters.due === o.value
                      ? 'bg-[rgb(var(--surface-3))] text-[rgb(var(--text))]'
                      : 'text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-2))]'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded px-2 py-1 text-[11px] text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-red-400"
              >
                <Icon name="x" size={10} /> Clear filters
              </button>
            )}
          </div>
        </Dropdown>
      </div>

      {/* ── Right actions ────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1">
        <div className="mx-0.5 h-4 w-px bg-[rgb(var(--border))] md:mx-1" />

        {/* Add column */}
        <Button variant="ghost" size="xs" onClick={() => setShowAddCol(true)}
          className="inline-flex items-center gap-1 text-xs">
          <Icon name="plus" size={12} /> <span className="hidden md:inline">Add column</span>
        </Button>

        {/* Undo / redo / sync / settings — inline on desktop */}
        <div className="hidden items-center gap-1 md:flex">
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
        </div>

        {/* Mobile: overflow (⋯) menu */}
        <div className="md:hidden">
          <Dropdown trigger={
            <div className="flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]">
              <Icon name="more-horizontal" size={16} />
            </div>
          }>
            <div className="w-44 py-1">
              <button type="button" onClick={() => undo(board.id)} disabled={!canUndo} className={overflowItemCls}>
                <Icon name="undo-2" size={14} /> Undo
              </button>
              <button type="button" onClick={() => redo(board.id)} disabled={!canRedo} className={overflowItemCls}>
                <Icon name="redo-2" size={14} /> Redo
              </button>
              <div className="my-1 h-px bg-[rgb(var(--border))]" />
              <button type="button" onClick={() => setBoardNoSync(board.id, !board.noSync)} className={overflowItemCls}>
                <Icon name={board.noSync ? 'cloud-off' : 'cloud'} size={14} /> {board.noSync ? 'Enable sync' : "Don't sync board"}
              </button>
              <button type="button" onClick={onOpenSettings} className={overflowItemCls}>
                <Icon name="settings" size={14} /> Board settings
              </button>
            </div>
          </Dropdown>
        </div>

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
