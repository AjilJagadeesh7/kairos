import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { db } from '../../db/schema'
import { useAppStore } from '../../store/useAppStore'
import { useConfirmStore } from '../../store/useConfirmStore'
import { cosineSimilarity } from '../../utils/similarity'
import { embedText } from '../../utils/embeddingClient'
import { Button } from '../ui/Button'
import type { Note } from '../../types'

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
  const navigate = useNavigate()
  const {
    activeNoteId,
    createNote,
    deleteNoteById,
    query,
    setQuery,
    filterTag,
    setFilterTag,
    searchMode,
  } = useAppStore()
  const [semanticResults, setSemanticResults] = useState<Note[] | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  const copyLink = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation()
    void navigator.clipboard.writeText(`[[${note.title}]]`)
    setCopiedId(note.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const note of notes) {
      for (const tag of note.tags) tags.add(tag)
    }
    return Array.from(tags).sort()
  }, [notes])

  const filtered = useMemo(() => {
    let list = notes
    if (filterTag) list = list.filter((n) => n.tags.includes(filterTag))
    if (!query.trim()) return list

    if (searchMode === 'fulltext') {
      const q = query.toLowerCase()
      return list.filter((n) => `${n.title}\n${n.content}`.toLowerCase().includes(q))
    }

    return list
  }, [notes, filterTag, query, searchMode])

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
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
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

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="relative mb-2">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchMode === 'semantic' ? 'Semantic search…' : 'Search notes…'}
            className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-sm text-text outline-none focus:border-text2 placeholder:text-text3"
          />
        </div>

        <div className="mb-3 flex gap-1">
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

        {allTags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            <Button
              variant="pill"
              size="xs"
              onClick={() => setFilterTag(undefined)}
              className={!filterTag ? 'active' : ''}
              aria-selected={!filterTag}
            >
              All
            </Button>
            {allTags.map((tag) => (
              <Button
                key={tag}
                variant="pill"
                size="xs"
                onClick={() => setFilterTag(tag)}
                className={filterTag === tag ? 'active' : ''}
                aria-selected={filterTag === tag}
              >
                #{tag}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Note list */}
      <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-4 pt-1">
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
                className={`group flex cursor-pointer select-none flex-col gap-1.5 rounded-lg border px-3 py-3 transition-colors ${
                  activeNoteId === note.id
                    ? 'border-accent/20 bg-surface shadow-sm'
                    : 'border-transparent hover:border-border hover:bg-surface'
                }`}
              >
                {/* Title */}
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-text">
                  {note.title || 'Untitled note'}
                </h3>

                {/* Tags */}
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((tag: string) => (
                      <span key={tag} className="rounded-full bg-surface3 px-2 py-0.5 text-[10px] font-medium text-text3">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bottom row: date + actions */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-text3">{timeAgo(note.updatedAt)}</span>

                  {/* Actions: always visible on mobile (no hover), visible on hover on desktop */}
                  <div className="flex items-center gap-0.5 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
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
              </div>
            </li>
          ))
        )}
      </ul>
    </aside>
  )
}
