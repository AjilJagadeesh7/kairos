import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Search, CornerDownLeft, FolderOpen,
  CalendarDays, LayoutList, Settings,
  Network, BookOpen, Plus,
  CheckSquare,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useJournalStore } from '../../store/useJournalStore'
import { useKanbanStore } from '../../store/useKanbanStore'
import {
  buildUniversalIndex, searchUniversal, searchByTitle,
} from '../../search/universalSearch'
import type { Note, JournalEntry } from '../../types'
import type { KanbanTask, Board } from '../../types/kanban.types'
import { todayDate } from '../../store/useJournalStore'

// ─── Static navigation / settings items ──────────────────────────────────────

interface NavItem {
  kind: 'nav'
  id: string
  label: string
  hint: string
  icon: React.ElementType
  path?: string
  action?: () => void
}

const NAV_ITEMS: NavItem[] = [
  { kind: 'nav', id: 'nav-notes',     label: 'Notes',              hint: 'Open Notes',                   icon: FileText,     path: '/notes' },
  { kind: 'nav', id: 'nav-journal',   label: 'Journal',            hint: "Open today's journal",          icon: CalendarDays, path: `/journal/${todayDate()}` },
  { kind: 'nav', id: 'nav-kanban',    label: 'Kanban',             hint: 'Open Kanban boards',            icon: LayoutList,   path: '/kanban' },
  { kind: 'nav', id: 'nav-graph',     label: 'Knowledge Graph',    hint: 'Open Knowledge Graph',          icon: Network,      path: '/graph' },
  { kind: 'nav', id: 'nav-settings',  label: 'Settings',           hint: 'Open Settings',                 icon: Settings,     path: '/settings' },
  { kind: 'nav', id: 'nav-new-note',  label: 'New note',           hint: 'Create a blank note',           icon: Plus,         path: undefined },
  // Settings sections
  { kind: 'nav', id: 'nav-s-general',   label: 'Settings → General',    hint: 'Appearance, font, theme',     icon: Settings, path: '/settings?section=general' },
  { kind: 'nav', id: 'nav-s-vault',     label: 'Settings → Vault',      hint: 'Connect or change vault folder', icon: BookOpen, path: '/settings?section=vault' },
  { kind: 'nav', id: 'nav-s-sync',      label: 'Settings → Sync',       hint: 'S3, WebDAV, Drive sync',      icon: Settings, path: '/settings?section=storage-sync' },
  { kind: 'nav', id: 'nav-s-ai',        label: 'Settings → AI',         hint: 'Semantic search, Ollama',     icon: Settings, path: '/settings?section=ai' },
  { kind: 'nav', id: 'nav-s-plugins',   label: 'Settings → Plugins',    hint: 'Manage installed plugins',    icon: Settings, path: '/settings?section=plugins' },
  { kind: 'nav', id: 'nav-s-keyboard',  label: 'Settings → Keyboard',   hint: 'Customize key bindings',      icon: Settings, path: '/settings?section=keyboard' },
  { kind: 'nav', id: 'nav-s-tags',      label: 'Settings → Tags',       hint: 'Tag colors and management',   icon: Settings, path: '/settings?section=tags' },
  { kind: 'nav', id: 'nav-s-logs',      label: 'Settings → Logs',       hint: 'View error logs',             icon: Settings, path: '/settings?section=logs' },
]

// ─── Result item union ────────────────────────────────────────────────────────

type ResultItem =
  | { kind: 'note';    note: Note;                        score: number }
  | { kind: 'journal'; entry: JournalEntry;               score: number }
  | { kind: 'task';    task: KanbanTask; board: Board;    score: number }
  | NavItem

function itemKey(item: ResultItem): string {
  if (item.kind === 'note')    return `note:${item.note.id}`
  if (item.kind === 'journal') return `journal:${item.entry.date}`
  if (item.kind === 'task')    return `task:${item.task.id}`
  return item.id
}

// ─── Format helpers ───────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatJournalDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const monthLabel = MONTHS[(m ?? 1) - 1] ?? ''
  const today = todayDate()
  if (date === today) return 'Today'
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (date === yesterday) return 'Yesterday'
  return `${monthLabel} ${d}, ${y}`
}

function excerpt(content: string, maxLen = 80): string {
  const stripped = content.replace(/[#*`_~\[\]]/g, '').replace(/\s+/g, ' ').trim()
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + '…' : stripped
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <li className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-text3">
      {label}
    </li>
  )
}

// ─── Single result row ────────────────────────────────────────────────────────

interface RowProps {
  item: ResultItem
  isActive: boolean
  onHover: () => void
  onClick: () => void
}

function ResultRow({ item, isActive, onHover, onClick }: RowProps) {
  const bg = isActive ? 'bg-accent/15' : 'hover:bg-surface2'

  if (item.kind === 'note') {
    const { note } = item
    return (
      <li
        role="option"
        aria-selected={isActive}
        onMouseEnter={onHover}
        onClick={onClick}
        className={`flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors ${bg}`}
      >
        <FileText size={14} className={`shrink-0 ${isActive ? 'text-accent' : 'text-text3'}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-text">{note.title || 'Untitled note'}</p>
          {note.folder && (
            <p className="flex items-center gap-1 truncate text-[11px] text-text3">
              <FolderOpen size={10} aria-hidden />{note.folder}
            </p>
          )}
        </div>
        {isActive && <CornerDownLeft size={12} className="shrink-0 text-text3" aria-hidden />}
      </li>
    )
  }

  if (item.kind === 'journal') {
    const { entry } = item
    const ex = excerpt(entry.content)
    return (
      <li
        role="option"
        aria-selected={isActive}
        onMouseEnter={onHover}
        onClick={onClick}
        className={`flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors ${bg}`}
      >
        <CalendarDays size={14} className={`shrink-0 ${isActive ? 'text-accent' : 'text-text3'}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-text">{formatJournalDate(entry.date)}</p>
          {ex && <p className="truncate text-[11px] text-text3">{ex}</p>}
        </div>
        {isActive && <CornerDownLeft size={12} className="shrink-0 text-text3" aria-hidden />}
      </li>
    )
  }

  if (item.kind === 'task') {
    const { task, board } = item
    return (
      <li
        role="option"
        aria-selected={isActive}
        onMouseEnter={onHover}
        onClick={onClick}
        className={`flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors ${bg}`}
      >
        <CheckSquare size={14} className={`shrink-0 ${isActive ? 'text-accent' : 'text-text3'}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-text">{task.title}</p>
          <p className="truncate text-[11px] text-text3">{board.title}</p>
        </div>
        {isActive && <CornerDownLeft size={12} className="shrink-0 text-text3" aria-hidden />}
      </li>
    )
  }

  // nav item
  const Icon = item.icon
  return (
    <li
      role="option"
      aria-selected={isActive}
      onMouseEnter={onHover}
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors ${bg}`}
    >
      <Icon size={14} className={`shrink-0 ${isActive ? 'text-accent' : 'text-text3'}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-text">{item.label}</p>
        <p className="truncate text-[11px] text-text3">{item.hint}</p>
      </div>
      {isActive && <CornerDownLeft size={12} className="shrink-0 text-text3" aria-hidden />}
    </li>
  )
}

// ─── Grouped result list ──────────────────────────────────────────────────────

interface GroupedSection {
  label: string
  items: ResultItem[]
}

function groupResults(items: ResultItem[]): GroupedSection[] {
  const nav     = items.filter(i => i.kind === 'nav')
  const notes   = items.filter(i => i.kind === 'note')
  const journal = items.filter(i => i.kind === 'journal')
  const tasks   = items.filter(i => i.kind === 'task')

  const sections: GroupedSection[] = []
  if (nav.length)     sections.push({ label: 'Navigate',      items: nav })
  if (notes.length)   sections.push({ label: 'Notes',          items: notes })
  if (journal.length) sections.push({ label: 'Journal',        items: journal })
  if (tasks.length)   sections.push({ label: 'Kanban tasks',   items: tasks })
  return sections
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

const MAX_RESULTS = 30

export function CommandPalette({ onClose }: Props) {
  const navigate  = useNavigate()
  const notes     = useAppStore(s => s.notes)
  const createNote = useAppStore(s => s.createNote)
  const journalEntriesMap = useJournalStore(s => s.entries)
  const journalEntries = useMemo(() => Object.values(journalEntriesMap), [journalEntriesMap])
  const boards    = useKanbanStore(s => s.boards)

  const [query, setQuery]   = useState('')
  const [active, setActive] = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLUListElement>(null)

  // Build index once when palette mounts (fast: ~1-3ms)
  useEffect(() => {
    buildUniversalIndex(notes, journalEntries, boards)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { inputRef.current?.focus() }, [])

  // ── Map helpers ──────────────────────────────────────────────────────────────
  const noteMap = useMemo(
    () => new Map(notes.map(n => [n.id, n])),
    [notes],
  )
  const taskBoardMap = useMemo(() => {
    const m = new Map<string, Board>()
    boards.forEach(b => b.tasks.forEach(t => m.set(t.id, b)))
    return m
  }, [boards])
  const taskMap = useMemo(() => {
    const m = new Map<string, KanbanTask>()
    boards.forEach(b => b.tasks.forEach(t => m.set(t.id, t)))
    return m
  }, [boards])
  const journalMap = useMemo(
    () => new Map(journalEntries.map(e => [e.date, e])),
    [journalEntries],
  )

  // ── Results computation ──────────────────────────────────────────────────────
  const results: ResultItem[] = useMemo(() => {
    const q = query.trim()

    if (!q) {
      // Empty query: show recent notes + today's journal + nav
      const recentNotes: ResultItem[] = [...notes]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8)
        .map(note => ({ kind: 'note' as const, note, score: 1 }))

      const todayEntry = journalMap.get(todayDate())
      const todayJournal: ResultItem[] = todayEntry
        ? [{ kind: 'journal' as const, entry: todayEntry, score: 1 }]
        : []

      return [...NAV_ITEMS.slice(0, 5), ...recentNotes, ...todayJournal]
    }

    // ── With query: run universal search ──────────────────────────────────────
    const hits = searchUniversal(q, MAX_RESULTS)
    const searchItems: ResultItem[] = []

    for (const hit of hits) {
      if (hit.kind === 'note') {
        const noteId = hit.id.slice(5) // strip "note:"
        const note = noteMap.get(noteId)
        if (note) searchItems.push({ kind: 'note', note, score: hit.score })
      } else if (hit.kind === 'journal') {
        const date = hit.id.slice(8) // strip "journal:"
        const entry = journalMap.get(date)
        if (entry) searchItems.push({ kind: 'journal', entry, score: hit.score })
      } else if (hit.kind === 'task') {
        const taskId = hit.id.slice(5) // strip "task:"
        const task = taskMap.get(taskId)
        const board = taskBoardMap.get(taskId)
        if (task && board) searchItems.push({ kind: 'task', task, board, score: hit.score })
      }
    }

    // Filter nav items by label / hint match
    const ql = q.toLowerCase()
    const matchedNav = NAV_ITEMS.filter(
      n => n.label.toLowerCase().includes(ql) || n.hint.toLowerCase().includes(ql),
    )

    // Nav items always come first, then content ranked by score
    return [...matchedNav, ...searchItems]
  }, [query, notes, journalMap, noteMap, taskMap, taskBoardMap])

  // ── Flat list for keyboard navigation ────────────────────────────────────────
  const flatItems = results // same array, already flat

  useEffect(() => { setActive(0) }, [results])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  // ── Actions ──────────────────────────────────────────────────────────────────
  const activate = useCallback((item: ResultItem) => {
    if (item.kind === 'note') {
      navigate(`/notes/${item.note.id}`)
    } else if (item.kind === 'journal') {
      navigate(`/journal/${item.entry.date}`)
    } else if (item.kind === 'task') {
      navigate(`/kanban/${item.board.id}`)
    } else if (item.kind === 'nav') {
      if (item.id === 'nav-new-note') {
        void createNote().then(id => navigate(`/notes/${id}`))
      } else if (item.path) {
        navigate(item.path)
      }
    }
    onClose()
  }, [navigate, createNote, onClose])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => Math.min(i + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatItems[active]
      if (item) activate(item)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  // ── Grouped sections for rendering ───────────────────────────────────────────
  const sections = useMemo(() => groupResults(results), [results])

  // Build a map from result key → flat index for active tracking
  const keyToIndex = useMemo(() => {
    const m = new Map<string, number>()
    flatItems.forEach((item, i) => m.set(itemKey(item), i))
    return m
  }, [flatItems])

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center bg-black/50 pt-[10vh] backdrop-blur-sm"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onKeyDown={onKeyDown}
      >
        {/* ── Search input ── */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={16} className="shrink-0 text-text3" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search notes, journal, tasks, settings…"
            aria-label="Search everything"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text3"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="shrink-0 text-text3 transition hover:text-text"
              aria-label="Clear"
            >
              ×
            </button>
          )}
          <kbd className="shrink-0 rounded border border-border bg-surface2 px-1.5 py-0.5 text-[11px] text-text3">Esc</kbd>
        </div>

        {/* ── Results ── */}
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className="max-h-[480px] overflow-y-auto py-1"
        >
          {flatItems.length === 0 && query && (
            <li className="px-4 py-8 text-center text-sm text-text3">
              No results for &ldquo;{query}&rdquo;
            </li>
          )}

          {sections.map(section => (
            <div key={section.label}>
              <SectionLabel label={section.label} />
              {section.items.map(item => {
                const key = itemKey(item)
                const idx = keyToIndex.get(key) ?? 0
                return (
                  <ResultRow
                    key={key}
                    item={item}
                    isActive={active === idx}
                    onHover={() => setActive(idx)}
                    onClick={() => activate(item)}
                  />
                )
              })}
            </div>
          ))}
        </ul>

        {/* ── Footer ── */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2">
          <span className="text-[11px] text-text3">
            <kbd className="rounded border border-border bg-surface2 px-1 py-0.5 text-[10px]">↑</kbd>
            <kbd className="ml-0.5 rounded border border-border bg-surface2 px-1 py-0.5 text-[10px]">↓</kbd>
            {' '}navigate
          </span>
          <span className="text-[11px] text-text3">
            <kbd className="rounded border border-border bg-surface2 px-1 py-0.5 text-[10px]">↵</kbd>
            {' '}open
          </span>
          <span className="ml-auto text-[11px] text-text3">
            {query
              ? `${flatItems.length} result${flatItems.length !== 1 ? 's' : ''}`
              : 'Recent + navigation'}
          </span>
        </div>
      </div>
    </div>
  )
}
