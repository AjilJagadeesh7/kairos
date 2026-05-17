import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useConfirmStore } from '../store/useConfirmStore'
import { useSemanticSearch } from './useSemanticSearch'
import { TAG_COLOR_PALETTE } from '../utils/kanban'
import type { Note, TagRecord } from '../types'

function tagColor(name: string): string {
  let h = 5381
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h) ^ name.charCodeAt(i)
  return TAG_COLOR_PALETTE[Math.abs(h) % TAG_COLOR_PALETTE.length]
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

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    notes.forEach(n => n.tags.forEach(t => tagSet.add(t)))
    return [...tagSet].sort()
  }, [notes])

  const tagMap = useMemo(
    () => new Map<string, TagRecord>(allTags.map(name => [name, { name, color: tagColor(name), createdAt: '' }])),
    [allTags],
  )

  const filtered = useMemo(() => {
    let list = [...notes]
    if (selectedTagFilters.length > 0) list = list.filter(n => selectedTagFilters.every(t => n.tags.includes(t)))
    if (!query.trim()) return list
    if (searchMode === 'fulltext') {
      const q = query.toLowerCase()
      return list.filter(n => `${n.title}\n${n.content}`.toLowerCase().includes(q))
    }
    return list
  }, [notes, selectedTagFilters, query, searchMode])

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
    allTags, tagMap, visible, copiedId, selectedTagFilters, setSelectedTagFilters,
    openNote, createAndOpen, handleDelete, copyLink,
  }
}
