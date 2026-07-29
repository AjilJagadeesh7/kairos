import { useState } from 'react'

import { useKanbanStore } from '../../../../store/useKanbanStore'
import { Button } from '../../../atoms/Button'
import { Select } from '../../../atoms/Select'
import { Dropdown } from '../../../molecules/Dropdown'
import { IssueTypeIcon } from '../../../atoms/IssueTypeIcon'
import { AddColumnModal } from './AddColumnModal'
import { ISSUE_TYPES, ISSUE_TYPE_META } from '../../../../utils/kanban'
import type { Board, DueFilter, IssueType, KanbanView, Priority } from '../../../../types/kanban.types'
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
  view: KanbanView
  onOpenSettings: () => void
}

/** Context toolbar beneath the tabs: search, filters, and view-aware actions. */
export function BoardHeader({ board, view, onOpenSettings }: BoardHeaderProps): JSX.Element {
  const undo         = useKanbanStore(s => s.undo)
  const redo         = useKanbanStore(s => s.redo)
  const history      = useKanbanStore(s => s.history)
  const createColumn = useKanbanStore(s => s.createColumn)
  const setBoardNoSync = useKanbanStore(s => s.setBoardNoSync)
  const rawFilters   = useKanbanStore(s => s.filters)
  const setFilters   = useKanbanStore(s => s.setFilters)
  const clearFilters = useKanbanStore(s => s.clearFilters)
  const groupBy      = useKanbanStore(s => s.groupBy)
  const setGroupBy   = useKanbanStore(s => s.setGroupBy)

  // Defensive defaults — tolerate filters persisted before newer fields existed.
  const filters = {
    tags: rawFilters.tags ?? [],
    priorities: rawFilters.priorities ?? [],
    types: rawFilters.types ?? [],
    due: rawFilters.due ?? 'all',
    linkedNote: rawFilters.linkedNote ?? null,
    query: rawFilters.query ?? '',
    sprint: rawFilters.sprint ?? null,
  }

  const sprints = [...(board.sprints ?? [])].sort((a, b) => a.order - b.order)
  const sprintOptions = [
    { value: 'all', label: 'All sprints' },
    { value: '__backlog__', label: 'Backlog' },
    ...sprints.map(s => ({ value: s.id, label: s.name })),
  ]

  const bh      = history[board.id]
  const canUndo = (bh?.past.length   ?? 0) > 0
  const canRedo = (bh?.future.length ?? 0) > 0

  const [showAddCol, setShowAddCol] = useState(false)

  const hasFilters =
    filters.priorities.length > 0 || filters.tags.length > 0 || filters.types.length > 0 ||
    filters.due !== 'all' || filters.linkedNote !== null || !!filters.query || !!filters.sprint

  function togglePriority(p: Priority) {
    setFilters({ priorities: filters.priorities.includes(p)
      ? filters.priorities.filter(x => x !== p)
      : [...filters.priorities, p] })
  }

  function toggleType(t: IssueType) {
    setFilters({ types: filters.types.includes(t)
      ? filters.types.filter(x => x !== t)
      : [...filters.types, t] })
  }

  function handleAddColumn(name: string, color: string) {
    createColumn(board.id, name, color)
    setShowAddCol(false)
  }

  return (
    <>
    <div className="touch-compact flex flex-shrink-0 items-center gap-1.5 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 py-2 md:gap-2 md:px-3">

      {/* ── Search ─────────────────────────────────────────────────── */}
      <div className="flex h-7 min-w-0 max-w-[220px] flex-1 items-center gap-1.5 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2 md:flex-none md:w-56">
        <Icon name="search" size={13} className="shrink-0 text-[rgb(var(--text-3))]" />
        <input
          value={filters.query}
          onChange={e => setFilters({ query: e.target.value })}
          placeholder="Search issues…"
          className="min-w-0 flex-1 bg-transparent text-xs text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))]"
        />
        {filters.query && (
          <button onClick={() => setFilters({ query: '' })} className="shrink-0 text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]">
            <Icon name="x" size={11} />
          </button>
        )}
      </div>

      {/* ── Type + priority + due filters (desktop) ────────────────── */}
      <div className="hidden items-center gap-1 overflow-x-auto overflow-y-hidden md:flex">
        {ISSUE_TYPES.map(t => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            title={`Filter: ${ISSUE_TYPE_META[t].label}`}
            className={`flex items-center rounded p-1 transition ${
              filters.types.includes(t) ? 'bg-[rgb(var(--surface-3))]' : 'opacity-50 hover:opacity-100'
            }`}
          >
            <IssueTypeIcon type={t} size={15} />
          </button>
        ))}

        <div className="mx-0.5 h-4 w-px bg-[rgb(var(--border))]" />

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

        <Select<DueFilter> value={filters.due} options={DUE_OPTIONS} onChange={due => setFilters({ due })} />

        {sprints.length > 0 && (
          <Select<string>
            value={filters.sprint ?? 'all'}
            options={sprintOptions}
            onChange={v => setFilters({ sprint: v === 'all' ? null : v })}
          />
        )}

        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-[rgb(var(--text-3))] hover:text-red-400">
            <Icon name="x" size={10} /> Clear
          </button>
        )}
      </div>

      {/* Mobile: filters dropdown */}
      <div className="md:hidden">
        <Dropdown trigger={
          <div className="relative flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]">
            <Icon name="list" size={13} />
            <Icon name="chevron-down" size={10} />
            {hasFilters && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" />}
          </div>
        }>
          <div className="w-56 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--text-3))]">Type</div>
            <div className="mb-2 flex flex-wrap gap-1">
              {ISSUE_TYPES.map(t => (
                <button key={t} onClick={() => toggleType(t)}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition ${
                    filters.types.includes(t) ? 'bg-[rgb(var(--surface-3))] text-[rgb(var(--text))]' : 'text-[rgb(var(--text-3))]'
                  }`}>
                  <IssueTypeIcon type={t} size={13} /> {ISSUE_TYPE_META[t].label}
                </button>
              ))}
            </div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--text-3))]">Priority</div>
            <div className="mb-2 flex flex-wrap gap-1">
              {PRIORITIES.map(p => (
                <button key={p} onClick={() => togglePriority(p)}
                  className={`whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium transition ${
                    filters.priorities.includes(p) ? 'bg-[rgb(var(--surface-3))] text-[rgb(var(--text))]' : 'text-[rgb(var(--text-3))]'
                  }`}>
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--text-3))]">Due date</div>
            <div className="flex flex-wrap gap-1">
              {DUE_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setFilters({ due: o.value })}
                  className={`whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium transition ${
                    filters.due === o.value ? 'bg-[rgb(var(--surface-3))] text-[rgb(var(--text))]' : 'text-[rgb(var(--text-3))]'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-2 flex w-full items-center justify-center gap-1 rounded px-2 py-1 text-[11px] text-[rgb(var(--text-3))] hover:text-red-400">
                <Icon name="x" size={10} /> Clear filters
              </button>
            )}
          </div>
        </Dropdown>
      </div>

      <div className="flex-1 md:flex-none" />

      {/* ── Right actions ────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1">
        {view === 'board' && (
          <button
            type="button"
            onClick={() => setGroupBy(groupBy === 'parent' ? 'none' : 'parent')}
            title="Group issues by parent story"
            aria-pressed={groupBy === 'parent'}
            className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition ${
              groupBy === 'parent'
                ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
                : 'text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]'
            }`}
          >
            <Icon name="layers" size={12} /> <span className="hidden md:inline">Group: {groupBy === 'parent' ? 'Subtask' : 'None'}</span>
          </button>
        )}
        {view === 'board' && (
          <Button variant="ghost" size="xs" onClick={() => setShowAddCol(true)} className="inline-flex items-center gap-1 text-xs">
            <Icon name="plus" size={12} /> <span className="hidden md:inline">Add column</span>
          </Button>
        )}

        <div className="hidden items-center gap-1 md:flex">
          <div className="mx-1 h-4 w-px bg-[rgb(var(--border))]" />
          <Button variant="ghost" size="xs" onClick={() => undo(board.id)} disabled={!canUndo} title="Undo (Ctrl+Z)" className="h-6 w-6 p-0 disabled:opacity-30">
            <Icon name="undo-2" size={12} />
          </Button>
          <Button variant="ghost" size="xs" onClick={() => redo(board.id)} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" className="h-6 w-6 p-0 disabled:opacity-30">
            <Icon name="redo-2" size={12} />
          </Button>
          <div className="mx-1 h-4 w-px bg-[rgb(var(--border))]" />
          <button type="button" onClick={() => setBoardNoSync(board.id, !board.noSync)}
            title={board.noSync ? 'Local only — click to sync this board' : "Don't sync this board"}
            aria-pressed={!!board.noSync}
            className={`flex h-6 w-6 items-center justify-center rounded transition ${
              board.noSync ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]'
            }`}>
            <Icon name={board.noSync ? 'cloud-off' : 'cloud'} size={12} />
          </button>
          <Button variant="ghost" size="xs" onClick={onOpenSettings} className="inline-flex items-center gap-1 text-xs">
            <Icon name="settings" size={12} /> Settings
          </Button>
        </div>

        {/* Mobile overflow */}
        <div className="md:hidden">
          <Dropdown trigger={
            <div className="flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]">
              <Icon name="more-horizontal" size={16} />
            </div>
          }>
            <div className="w-44 py-1">
              <button type="button" onClick={() => undo(board.id)} disabled={!canUndo} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))] disabled:opacity-30">
                <Icon name="undo-2" size={14} /> Undo
              </button>
              <button type="button" onClick={() => redo(board.id)} disabled={!canRedo} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))] disabled:opacity-30">
                <Icon name="redo-2" size={14} /> Redo
              </button>
              <div className="my-1 h-px bg-[rgb(var(--border))]" />
              <button type="button" onClick={() => setBoardNoSync(board.id, !board.noSync)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))]">
                <Icon name={board.noSync ? 'cloud-off' : 'cloud'} size={14} /> {board.noSync ? 'Enable sync' : "Don't sync board"}
              </button>
              <button type="button" onClick={onOpenSettings} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))]">
                <Icon name="settings" size={14} /> Board settings
              </button>
            </div>
          </Dropdown>
        </div>

        <SlotRenderer slot="kanban:toolbar:end" props={{ boardId: board.id }} className="flex items-center" />
      </div>
    </div>

    {showAddCol && (
      <AddColumnModal onConfirm={handleAddColumn} onClose={() => setShowAddCol(false)} defaultColor={undefined} />
    )}
    </>
  )
}
