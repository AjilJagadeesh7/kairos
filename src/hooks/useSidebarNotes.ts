import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useConfirmStore } from '../store/useConfirmStore'
import { useSemanticSearch } from './useSemanticSearch'
import { searchNotes, isIndexReady } from '../search/noteIndex'
import { TAG_COLOR_PALETTE } from '../utils/kanban'
import type { Note, TagRecord } from '../types'

export type DateFilter = 'any' | 'today' | 'week' | 'month'

function tagColor(name: string): string {
  let h = 5381
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h) ^ name.charCodeAt(i)
  return TAG_COLOR_PALETTE[Math.abs(h) % TAG_COLOR_PALETTE.length]
}

function withinDateRange(iso: string, filter: DateFilter): boolean {
  if (filter === 'any') return true
  const now  = Date.now()
  const date = new Date(iso).getTime()
  const ms   = now - date
  if (filter === 'today') return ms < 86_400_000
  if (filter === 'week')  return ms < 7 * 86_400_000
  if (filter === 'month') return ms < 30 * 86_400_000
  return true
}

export function useSidebarNotes(onClose?: () => void) {
  const notes          = useAppStore(s => s.notes)
  const isNotesLoaded  = useAppStore(s => s.isNotesLoaded)
  const activeNoteId   = useAppStore(s => s.activeNoteId)
  const createNote     = useAppStore(s => s.createNote)
  const deleteNoteById = useAppStore(s => s.deleteNoteById)
  const query          = useAppStore(s => s.query)
  const setQuery       = useAppStore(s => s.setQuery)
  const searchMode     = useAppStore(s => s.searchMode)
  const navigate       = useNavigate()

  const [copiedId,           setCopiedId]           = useState<string | null>(null)
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([])
  const [dateFilter,         setDateFilter]         = useState<DateFilter>('any')

  const allTags = useMemo((): TagRecord[] => {
    const tagSet = new Set<string>()
    notes.forEach(n => n.tags.forEach(t => tagSet.add(t)))
    return [...tagSet].sort().map(name => ({ name, color: tagColor(name), createdAt: '' }))
  }, [notes])

  const tagMap = useMemo(
    () => new Map<string, TagRecord>(allTags.map(tag => [tag.name, tag])),
    [allTags],
  )

  // Index-based full-text search with fuzzy + prefix matching
  const indexResults = useMemo(() => {
    if (!query.trim() || searchMode !== 'fulltext' || !isIndexReady()) return null
    const hits = searchNotes(query)
    const hitIds = new Map(hits.map(h => [h.id, h.score]))
    // Sort by search score, preserving ranked order
    return notes
      .filter(n => hitIds.has(n.id))
      .sort((a, b) => (hitIds.get(b.id) ?? 0) - (hitIds.get(a.id) ?? 0))
  }, [notes, query, searchMode])

  const filtered = useMemo(() => {
    // Start from index results (fulltext) or all notes
    let list = indexResults !== null ? indexResults : [...notes]

    // Tag filters
    if (selectedTagFilters.length > 0) {
      list = list.filter(n => selectedTagFilters.every(t => n.tags.includes(t)))
    }

    // Date filter on updatedAt
    if (dateFilter !== 'any') {
      list = list.filter(n => withinDateRange(n.updatedAt, dateFilter))
    }

    // For non-fulltext modes with no index, apply plain text filter
    if (query.trim() && searchMode !== 'fulltext' && searchMode !== 'semantic') {
      const q = query.toLowerCase()
      list = list.filter(n => `${n.title}\n${n.content}`.toLowerCase().includes(q))
    }

    return list
  }, [notes, indexResults, selectedTagFilters, dateFilter, query, searchMode])

  const semanticResults = useSemanticSearch(filtered, query, searchMode)
  const visible = searchMode === 'semantic' && query.trim() ? (semanticResults ?? filtered) : filtered

  function openNote(id: string) {
    navigate(`/notes/${id}`)
    onClose?.()
  }

  function createAndOpen() {
    void createNote().then(id => { navigate(`/notes/${id}`); onClose?.() })
  }

  function handleDelete(e: React.MouseEvent, note: Note) {
    e.stopPropagation()
    void useConfirmStore.getState()
      .confirm({ title: `Delete "${note.title || 'Untitled note'}"?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })
      .then(ok => { if (ok) void deleteNoteById(note.id) })
  }

  function copyLink(e: React.MouseEvent, note: Note) {
    e.stopPropagation()
    void navigator.clipboard.writeText(`[[${note.title}]]`)
    setCopiedId(note.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return {
    notes, isNotesLoaded, activeNoteId, query, setQuery, searchMode,
    allTags, tagMap, visible, copiedId,
    selectedTagFilters, setSelectedTagFilters,
    dateFilter, setDateFilter,
    openNote, createAndOpen, handleDelete, copyLink,
  }
}

