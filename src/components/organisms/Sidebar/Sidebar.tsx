import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { useSemanticSearch } from '../../../hooks/useSemanticSearch'
import { timeAgo } from '../../../utils/timeAgo'
import { TAG_COLOR_PALETTE } from '../../../utils/kanban'
import { Button } from '../../atoms/Button'
import { TagBadge } from '../../atoms/TagBadge'
import { Dropdown } from '../../molecules/Dropdown'
import { TagFiltersDropdown } from '../../molecules/TagFiltersDropdown'
import { SearchModePills } from '../../molecules/SearchModePills'
import { SelectedFilters } from '../../molecules/SelectedFilters'
import type { Note, TagRecord } from '../../../types'

interface SidebarProps {
  onClose?: () => void
}

function tagColor(name: string): string {
  let h = 5381
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h) ^ name.charCodeAt(i)
  }
  return TAG_COLOR_PALETTE[Math.abs(h) % TAG_COLOR_PALETTE.length]
}

export function Sidebar({ onClose }: SidebarProps): JSX.Element {
  const notes = useAppStore(s => s.notes)
  const isNotesLoaded = useAppStore(s => s.isNotesLoaded)
  const navigate = useNavigate()
  const {
    activeNoteId,
    createNote,
    deleteNoteById,
    query,
    setQuery,
    searchMode,
  } = useAppStore()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    notes.forEach(n => n.tags.forEach(t => tagSet.add(t)))
    return [...tagSet].sort()
  }, [notes])

  const tagMap = useMemo(() => {
    return new Map<string, TagRecord>(
      allTags.map(name => [name, { name, color: tagColor(name), createdAt: '' }]),
    )
  }, [allTags])

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

  const filtered = useMemo(() => {
    let list = [...notes]

    if (selectedTagFilters.length > 0) {
      list = list.filter((n) => selectedTagFilters.every(tag => n.tags.includes(tag)))
    }

    if (!query.trim()) return list

    if (searchMode === 'fulltext') {
      const q = query.toLowerCase()
      return list.filter((n) => `${n.title}\n${n.content}`.toLowerCase().includes(q))
    }

    return list
  }, [notes, selectedTagFilters, query, searchMode])

  const semanticResults = useSemanticSearch(filtered, query, searchMode)

  const visible = searchMode === 'semantic' && query.trim() ? semanticResults ?? filtered : filtered

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface2">
      {/* Header */}
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
      <div className="sidebar-top border-b border-border px-3 py-3">
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
          <SearchModePills
            searchMode={searchMode}
            onSearchModeChange={(mode) => useAppStore.getState().setSearchMode(mode)}
          />
          <span className="sidebar-note-count ml-auto rounded-full bg-surface3 px-2 py-1 text-[10px] text-text3">
            {visible.length} {visible.length === 1 ? 'note' : 'notes'}
          </span>
        </div>

        <div className="sidebar-filter-group relative mb-3">
          <Dropdown>
            <span className="text-text3">Filters</span>
            <TagFiltersDropdown
              allTags={allTags}
              selectedTagFilters={selectedTagFilters}
              onTagFiltersChange={setSelectedTagFilters}
            />
          </Dropdown>
        </div>

        <SelectedFilters
          selectedTagFilters={selectedTagFilters}
          tagMap={tagMap}
        />
      </div>

      {/* Note list */}
      <ul className="flex-1 space-y-1 overflow-y-auto border-t border-border px-2 pb-4 pt-4">
        {!isNotesLoaded ? (
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
