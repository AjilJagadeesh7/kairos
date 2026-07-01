import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useJournalStore } from '../../store/useJournalStore'
import { useKanbanStore } from '../../store/useKanbanStore'
import { useCanvasStore } from '../../store/useCanvasStore'
import { usePenNoteStore } from '../../store/usePenNoteStore'
import { useAttachmentStore } from '../../store/useAttachmentStore'
import { usePaneStore } from '../../store/usePaneStore'
import { buildUniversalIndex, searchUniversal } from '../../search/universalSearch'
import { todayDate } from '../../store/useJournalStore'
import { Icon } from '../../icons/Icon'
import type { KanbanTask, Board } from '../../types/kanban.types'
import { NAV_ITEMS, itemKey, groupResults } from './commandPaletteItems'
import type { ResultItem } from './commandPaletteItems'
import { ResultRow, SectionLabel } from './CommandPaletteRow'
import { KbdKey } from '../atoms/KbdKey'

const MAX_RESULTS = 30

interface Props { onClose: () => void }

export function CommandPalette({ onClose }: Props) {
  const notes              = useAppStore(s => s.notes)
  const createNote         = useAppStore(s => s.createNote)
  const journalEntriesMap  = useJournalStore(s => s.entries)
  const journalEntries     = useMemo(() => Object.values(journalEntriesMap), [journalEntriesMap])
  const boards             = useKanbanStore(s => s.boards)
  const canvases           = useCanvasStore(s => s.canvases)
  const penNotes           = usePenNoteStore(s => s.penNotes)
  const attachments        = useAttachmentStore(s => s.attachments)

  const [query, setQuery]   = useState('')
  const [active, setActive] = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLUListElement>(null)

  useEffect(() => {
    buildUniversalIndex(notes, journalEntries, boards, canvases, penNotes, attachments)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { inputRef.current?.focus() }, [])

  const noteMap = useMemo(() => new Map(notes.map(n => [n.id, n])), [notes])
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
  const journalMap = useMemo(() => new Map(journalEntries.map(e => [e.date, e])), [journalEntries])
  const canvasMap  = useMemo(() => new Map(canvases.map(c => [c.id, c])), [canvases])
  const penNoteMap = useMemo(() => new Map(penNotes.map(p => [p.id, p])), [penNotes])
  const attachmentMap = useMemo(() => new Map(attachments.map(a => [a.id, a])), [attachments])

  const results: ResultItem[] = useMemo(() => {
    const q = query.trim()

    if (!q) {
      const recentNotes: ResultItem[] = [...notes]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8)
        .map(note => ({ kind: 'note' as const, note, score: 1 }))
      const todayEntry = journalMap.get(todayDate())
      const todayJournal: ResultItem[] = todayEntry
        ? [{ kind: 'journal' as const, entry: todayEntry, score: 1 }]
        : []
      return [...NAV_ITEMS.slice(0, 6), ...recentNotes, ...todayJournal]
    }

    const hits = searchUniversal(q, MAX_RESULTS)
    const searchItems: ResultItem[] = []

    for (const hit of hits) {
      if (hit.kind === 'note') {
        const note = noteMap.get(hit.id.slice(5))
        if (note) searchItems.push({ kind: 'note', note, score: hit.score })
      } else if (hit.kind === 'journal') {
        const entry = journalMap.get(hit.id.slice(8))
        if (entry) searchItems.push({ kind: 'journal', entry, score: hit.score })
      } else if (hit.kind === 'task') {
        const task = taskMap.get(hit.id.slice(5))
        const board = taskBoardMap.get(hit.id.slice(5))
        if (task && board) searchItems.push({ kind: 'task', task, board, score: hit.score })
      } else if (hit.kind === 'canvas') {
        const canvas = canvasMap.get(hit.id.slice(7))
        if (canvas) searchItems.push({ kind: 'canvas', canvas, score: hit.score })
      } else if (hit.kind === 'pennote') {
        const penNote = penNoteMap.get(hit.id.slice(8))
        if (penNote) searchItems.push({ kind: 'pennote', penNote, score: hit.score })
      } else if (hit.kind === 'attachment') {
        const attachment = attachmentMap.get(hit.id.slice(11))
        if (attachment) searchItems.push({ kind: 'attachment', attachment, score: hit.score })
      }
    }

    const ql = q.toLowerCase()
    const matchedNav = NAV_ITEMS.filter(
      n => n.label.toLowerCase().includes(ql) || n.hint.toLowerCase().includes(ql),
    )
    return [...matchedNav, ...searchItems]
  }, [query, notes, journalMap, noteMap, taskMap, taskBoardMap, canvasMap, penNoteMap, attachmentMap])

  const flatItems = results
  useEffect(() => { setActive(0) }, [results])
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const activate = useCallback((item: ResultItem) => {
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    const go = (path: string) => navigatePane(focusedPaneId, path)

    if (item.kind === 'note')         go(`/notes/${item.note.id}`)
    else if (item.kind === 'journal') go(`/journal/${item.entry.date}`)
    else if (item.kind === 'task')    go(`/kanban/${item.board.id}`)
    else if (item.kind === 'canvas')  go(`/canvas/${item.canvas.id}`)
    else if (item.kind === 'pennote') go(`/pennote/${item.penNote.id}`)
    else if (item.kind === 'attachment') go(`/attachments/${item.attachment.id}`)
    else if (item.kind === 'nav') {
      if (item.id === 'nav-new-note') void createNote().then(id => go(`/notes/${id}`))
      else if (item.path) go(item.path)
    }
    onClose()
  }, [createNote, onClose])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActive(i => Math.min(i + 1, flatItems.length - 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter')     { e.preventDefault(); const item = flatItems[active]; if (item) activate(item) }
    else if (e.key === 'Escape')    { onClose() }
  }

  const sections   = useMemo(() => groupResults(results), [results])
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
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Icon name="search" size={16} className="shrink-0 text-text3" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search notes, journal, tasks, settings…"
            aria-label="Search everything"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text3"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="shrink-0 text-text3 transition hover:text-text" aria-label="Clear">×</button>
          )}
          <KbdKey className="shrink-0">Esc</KbdKey>
        </div>

        <ul ref={listRef} role="listbox" aria-label="Search results" className="max-h-[480px] overflow-y-auto py-1">
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
                  <ResultRow key={key} item={item} idx={idx}
                    isActive={active === idx}
                    onHover={() => setActive(idx)}
                    onClick={() => activate(item)}
                  />
                )
              })}
            </div>
          ))}
        </ul>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2">
          <span className="text-[11px] text-text3">
            <KbdKey className="px-1 text-[10px]">↑</KbdKey>
            <KbdKey className="ml-0.5 px-1 text-[10px]">↓</KbdKey>
            {' '}navigate
          </span>
          <span className="text-[11px] text-text3">
            <KbdKey className="px-1 text-[10px]">↵</KbdKey>
            {' '}open
          </span>
          <span className="ml-auto text-[11px] text-text3">
            {query ? `${flatItems.length} result${flatItems.length !== 1 ? 's' : ''}` : 'Recent + navigation'}
          </span>
        </div>
      </div>
    </div>
  )
}
