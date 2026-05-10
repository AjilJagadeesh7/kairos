import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Loader2, Plus, Search, Trash2, X, ChevronDown } from 'lucide-react'
import { db, getAllTags } from '../../db/schema'
import { useAppStore } from '../../store/useAppStore'
import { useConfirmStore } from '../../store/useConfirmStore'
import { cosineSimilarity } from '../../utils/similarity'
import { embedText } from '../../utils/embeddingClient'
import { Button } from '../ui/Button'
import { TagBadge } from '../Tags/TagBadge'
import { TagChip } from '../Tags/TagChip'
import { isLocalFolderConnected } from '../../sync/localFolder'
import type { Note, TagRecord } from '../../types'

type StorageCategory = 'all' | 'memory' | 'local' | 'synced'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps): JSX.Element {
  // Always ordered by last saved (updatedAt desc) — Dexie keeps this live
  const rawNotes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray())
  const notes = rawNotes ?? []
  const isLoading = rawNotes === undefined
  const syncMetaData = useLiveQuery(() => db.syncMeta.toArray())
  const allTagsData = useLiveQuery(() => getAllTags())
  const navigate = useNavigate()
  const {
    activeNoteId,
    createNote,
    deleteNoteById,
    query,
    setQuery,
    searchMode,
    syncProvider,
  } = useAppStore()
  const [semanticResults, setSemanticResults] = useState<Note[] | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [storageCategory, setStorageCategory] = useState<StorageCategory>('all')
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([])
  const [tagSearch, setTagSearch] = useState('')
  const [tagMap, setTagMap] = useState<Map<string, TagRecord>>(new Map())
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false)

  const allTags = useMemo(
    () => (allTagsData ? [...allTagsData].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [allTagsData],
  )

  const handleDelete = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation()
    void useConfirmStore.getState()
      .confirm({
        title: `Delete "${note.title || 'Untitled note'}"?`,
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
      })
      .then((ok) => { if (ok) void deleteNoteById(note.id) })
  }

  // Determine storage location for a note
  const getStorageLocation = (noteId: string): 'memory' | 'local' | 'synced' => {
    const syncMeta = syncMetaData?.find((m) => m.noteId === noteId)
    if (!syncMeta) return 'memory'
    
    if (syncProvider === 'localFolder' || isLocalFolderConnected()) {
      return 'local'
    }
    
    return 'synced'
  }

  const copyLink = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation()
    void navigator.clipboard.writeText(`[[${note.title}]]`)
    setCopiedId(note.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // Build tag map for quick lookup
  useEffect(() => {
    if (allTagsData) {
      const map = new Map(allTagsData.map((tag) => [tag.name, tag]))
      setTagMap(map)
    }
  }, [allTagsData])

  const categoryCounts = useMemo(() => {
    const counts = { all: notes.length, memory: 0, local: 0, synced: 0 }
    for (const note of notes) {
      const location = getStorageLocation(note.id)
      counts[location] += 1
    }
    return counts
  }, [notes, syncMetaData, syncProvider])

  const filtered = useMemo(() => {
    let list = notes

    // Filter by tags (multiple selection)
    if (selectedTagFilters.length > 0) {
      list = list.filter((n) => selectedTagFilters.every(tag => n.tags.includes(tag)))
    }

    // Filter by storage category
    if (storageCategory !== 'all') {
      list = list.filter((n) => getStorageLocation(n.id) === storageCategory)
    }

    if (!query.trim()) return list

    if (searchMode === 'fulltext') {
      const q = query.toLowerCase()
      return list.filter((n) => `${n.title}\n${n.content}`.toLowerCase().includes(q))
    }

    return list
  }, [notes, selectedTagFilters, query, searchMode, storageCategory, syncMetaData, syncProvider, getStorageLocation])

  useEffect(() => {
    let mounted = true
    async function runSemanticSearch() {
      const q = query.trim()
      if (!q || searchMode !== 'semantic') {
        if (mounted) setSemanticResults(null)
        return
      }

      const queryEmbedding = (await embedText('semantic-query', q)).embedding
      // Load embeddings from the dedicated table (cheap — no note content involved)
      const allEmbeddings = await db.embeddings.toArray()
      const embeddingMap = new Map(allEmbeddings.map((r) => [r.noteId, r.data]))

      const ranked = filtered
        .map((note) => {
          const emb = embeddingMap.get(note.id) ?? []
          return { note, score: emb.length > 0 ? cosineSimilarity(queryEmbedding, emb) : -1 }
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 30)
        .map((item) => item.note)

      if (mounted) setSemanticResults(ranked)
    }

    void runSemanticSearch()
    return () => {
      mounted = false
    }
  }, [query, searchMode, filtered])

  const visible = searchMode === 'semantic' && query.trim() ? semanticResults ?? filtered : filtered

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface2">
      {/* Header: title + close button (mobile) + new note */}
      <div className="sidebar-header flex items-center gap-2 border-b border-border px-3 py-3">
        <span className="flex-1 text-xs font-semibold uppercase tracking-widest text-text3">Notes</span>
        <Button
          variant="primary"
          size="xs"
          onClick={() => { void createNote().then((id) => { navigate(`/notes/${id}`); onClose?.() }) }}
          className="inline-flex items-center gap-1"
        >
          <Plus size={13} /> New
        </Button>
        {/* Close sidebar — mobile/tablet only */}
        {onClose && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text2 transition hover:bg-surface3 hover:text-text xl:hidden"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search section */}
      <div className="sidebar-top border-b border-border px-3 py-3">
        {/* Search bar */}
        <div className="relative mb-3">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchMode === 'semantic' ? 'Semantic search…' : 'Search notes…'}
            className="sidebar-search w-full rounded-2xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text outline-none focus:border-text2 placeholder:text-text3"
          />
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
          <div className="flex flex-wrap gap-1">
            <Button
              variant="pill"
              size="xs"
              onClick={() => useAppStore.getState().setSearchMode('fulltext')}
              className={searchMode === 'fulltext' ? 'active' : ''}
              aria-selected={searchMode === 'fulltext'}
            >
              Full text
            </Button>
            <Button
              variant="pill"
              size="xs"
              onClick={() => useAppStore.getState().setSearchMode('semantic')}
              className={searchMode === 'semantic' ? 'active' : ''}
              aria-selected={searchMode === 'semantic'}
            >
              Semantic
            </Button>
          </div>
          <span className="sidebar-note-count ml-auto rounded-full bg-surface3 px-2 py-1 text-[10px] text-text3">
            {visible.length} {visible.length === 1 ? 'note' : 'notes'}
          </span>
        </div>

        <div className="sidebar-storage-grid mb-4 grid grid-cols-2 gap-2 text-[10px]">
          <Button
            variant="pill"
            size="xs"
            onClick={() => setStorageCategory('all')}
            className={storageCategory === 'all' ? 'active' : ''}
            aria-selected={storageCategory === 'all'}
          >
            All · {categoryCounts.all}
          </Button>
          <Button
            variant="pill"
            size="xs"
            onClick={() => setStorageCategory('memory')}
            className={storageCategory === 'memory' ? 'active' : ''}
            aria-selected={storageCategory === 'memory'}
          >
            Memory · {categoryCounts.memory}
          </Button>
          <Button
            variant="pill"
            size="xs"
            onClick={() => setStorageCategory('local')}
            className={storageCategory === 'local' ? 'active' : ''}
            aria-selected={storageCategory === 'local'}
          >
            Local · {categoryCounts.local}
          </Button>
          <Button
            variant="pill"
            size="xs"
            onClick={() => setStorageCategory('synced')}
            className={storageCategory === 'synced' ? 'active' : ''}
            aria-selected={storageCategory === 'synced'}
          >
            Synced · {categoryCounts.synced}
          </Button>
        </div>

        {/* Filters dropdown */}
        <div className="sidebar-filter-group relative">
          <button
            type="button"
            onClick={() => setShowFiltersDropdown(!showFiltersDropdown)}
            className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-2 py-2 text-xs text-text outline-none hover:bg-surface2 focus:border-accent"
          >
            <span className="text-text3">Filters</span>
            <ChevronDown size={12} className={`text-text3 transition-transform ${showFiltersDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showFiltersDropdown && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-surface p-3 shadow-lg">
              <div className="space-y-3">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-text3">Tag filter</p>
                    <button
                      type="button"
                      onClick={() => setSelectedTagFilters([])}
                      className="text-[10px] font-semibold text-accent hover:text-accent/80"
                    >
                      Clear
                    </button>
                  </div>
                  <input
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Search tags…"
                    className="w-full rounded-md border border-border bg-surface px-2 py-2 text-xs text-text outline-none focus:border-accent placeholder:text-text3"
                  />
                  <div className="mt-3 flex max-h-32 flex-wrap gap-1 overflow-y-auto pb-1">
                    {allTags
                      .filter((tag) => tag.name.includes(tagSearch.toLowerCase()))
                      .slice(0, 20)
                      .map((tag) => (
                        <TagChip
                          key={tag.name}
                          tag={tag}
                          selected={selectedTagFilters.includes(tag.name)}
                          onClick={() => {
                            setSelectedTagFilters(prev =>
                              prev.includes(tag.name)
                                ? prev.filter(t => t !== tag.name)
                                : [...prev, tag.name]
                            )
                          }}
                        />
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text3">
          {selectedTagFilters.length > 0 ? (
            selectedTagFilters.map(tagName => {
              const tag = tagMap.get(tagName)
              return tag ? (
                <span
                  key={tagName}
                  className="rounded-full border border-border bg-surface3 px-2 py-0.5 text-[10px] text-text3"
                  style={{ borderColor: tag.color + '40', backgroundColor: tag.color + '20' }}
                >
                  #{tagName}
                </span>
              ) : null
            })
          ) : (
            <span className="rounded-full border border-border bg-surface3 px-2 py-0.5 text-[10px] text-text3">No tag filter</span>
          )}
          {storageCategory !== 'all' && (
            <span className="rounded-full border border-border bg-surface3 px-2 py-0.5 text-[10px] text-text3">
              {storageCategory === 'memory' ? 'Memory' : storageCategory === 'local' ? 'Local' : 'Synced'}
            </span>
          )}
        </div>
      </div>

      {/* Note list */}
      <ul className="flex-1 space-y-1 overflow-y-auto border-t border-border px-2 pb-4 pt-4">
        {isLoading ? (
          <li className="flex items-center justify-center py-10 text-text3">
            <Loader2 size={20} className="animate-spin" />
          </li>
        ) : visible.length === 0 ? (
          <li className="py-8 text-center text-xs text-text3">No notes found</li>
        ) : (
          visible.map((note) => (
            <li key={note.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => { navigate(`/notes/${note.id}`); onClose?.() }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { navigate(`/notes/${note.id}`); onClose?.() } }}
                className={`group sidebar-note-card flex cursor-pointer select-none items-center gap-2 rounded-lg border px-2 py-2 transition-colors ${
                  activeNoteId === note.id
                    ? 'active border-accent/20 bg-surface shadow-sm'
                    : 'border-border bg-surface2 hover:border-accent/30 hover:bg-surface'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="note-title min-w-0 truncate text-[11px] font-semibold text-text">
                      {note.title || 'Untitled note'}
                    </h3>
                    <span className="note-meta whitespace-nowrap text-[10px] text-text3">{timeAgo(note.updatedAt)}</span>
                  </div>
                  {note.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {note.tags.slice(0, 2).map((tagName) => {
                        const tag = tagMap.get(tagName)
                        return tag ? <TagBadge key={tagName} tag={tag} variant="sm" /> : null
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Copy wikilink"
                    onClick={(e) => copyLink(e, note)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-text3 transition hover:bg-surface2 hover:text-text active:scale-95"
                  >
                    {copiedId === note.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                  <button
                    type="button"
                    title="Delete note"
                    onClick={(e) => handleDelete(e, note)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-text3 transition hover:bg-surface2 hover:text-red-400 active:scale-95"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </aside>
  )
}
