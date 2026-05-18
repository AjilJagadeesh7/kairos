import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { useSidebarNotes } from '../../../hooks/useSidebarNotes'
import type { DateFilter } from '../../../hooks/useSidebarNotes'
import { Button } from '../../atoms/Button'
import { Dropdown } from '../../molecules/Dropdown'
import { TagFiltersDropdown } from '../../molecules/TagFiltersDropdown'
import { SearchModePills } from '../../molecules/SearchModePills'
import { SelectedFilters } from '../../molecules/SelectedFilters'
import { NoteListItem } from '../../molecules/NoteListItem'
import { NoteTemplateModal } from '../Notes/NoteTemplateModal'
import type { NoteTemplate } from '../Notes/NoteTemplateModal'

const DATE_FILTERS: { label: string; value: DateFilter }[] = [
  { label: 'Any time', value: 'any' },
  { label: 'Today',    value: 'today' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
]

interface Props {
  onClose?: () => void
}

export function Sidebar({ onClose }: Props): JSX.Element {
  const listRef = useRef<HTMLUListElement>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const createNote = useAppStore(s => s.createNote)
  const navigate = useNavigate()
  const {
    isNotesLoaded, activeNoteId, query, setQuery, searchMode,
    allTags, tagMap, visible, copiedId, selectedTagFilters, setSelectedTagFilters,
    dateFilter, setDateFilter,
    openNote, handleDelete, copyLink,
  } = useSidebarNotes(onClose)

  function handleTemplateSelect(template: NoteTemplate) {
    setShowTemplates(false)
    void createNote(template.id === 'blank' ? undefined : { title: template.title, content: template.content })
      .then(id => {
        navigate(`/notes/${id}`)
        onClose?.()
      })
  }

  // Arrow-key navigation within the note list
  function onListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    const items = listRef.current?.querySelectorAll<HTMLElement>('[data-note-item]')
    if (!items || items.length === 0) return
    const current = document.activeElement as HTMLElement
    const idx = Array.from(items).indexOf(current)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[Math.min(idx + 1, items.length - 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[Math.max(idx - 1, 0)]?.focus()
    }
  }

  return (
    <>
    {showTemplates && (
      <NoteTemplateModal onSelect={handleTemplateSelect} onClose={() => setShowTemplates(false)} />
    )}
    <aside
      aria-label="Notes sidebar"
      className="flex h-full w-full flex-col border-r border-border bg-surface2"
    >
      <div className="sidebar-header flex items-center gap-2 border-b border-border px-3 py-3">
        <span className="flex-1 text-xs font-semibold uppercase tracking-widest text-text3">Notes</span>
        <Button
          variant="primary"
          size="xs"
          onClick={() => setShowTemplates(true)}
          aria-label="New note"
          className="inline-flex items-center gap-1"
        >
          <Plus size={13} aria-hidden /> New
        </Button>
        {onClose && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text2 transition hover:bg-surface3 hover:text-text xl:hidden"
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>

      <div className="sidebar-top border-b border-border px-3 py-3">
        {/* Search input */}
        <div className="relative mb-3">
          <Search size={13} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchMode === 'semantic' ? 'Semantic search…' : 'Search notes…'}
            aria-label="Search notes"
            className="sidebar-search w-full rounded-2xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text outline-none focus:border-text2 focus-visible:ring-2 focus-visible:ring-accent/30 placeholder:text-text3"
          />
        </div>

        {/* Search mode + count */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
          <SearchModePills
            searchMode={searchMode}
            onSearchModeChange={mode => useAppStore.getState().setSearchMode(mode)}
          />
          <span className="sidebar-note-count ml-auto rounded-full bg-surface3 px-2 py-1 text-[10px] text-text3">
            {visible.length} {visible.length === 1 ? 'note' : 'notes'}
          </span>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2">
          <div className="sidebar-filter-group relative flex-1">
            <Dropdown>
              <span className="text-text3">Tag filters</span>
              <TagFiltersDropdown
                allTags={allTags}
                selectedTagFilters={selectedTagFilters}
                onTagFiltersChange={setSelectedTagFilters}
              />
            </Dropdown>
          </div>

          {/* Date filter */}
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value as DateFilter)}
            aria-label="Filter by date"
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-[11px] text-text2 outline-none focus:border-text2 focus-visible:ring-2 focus-visible:ring-accent/30"
          >
            {DATE_FILTERS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        <SelectedFilters selectedTagFilters={selectedTagFilters} tagMap={tagMap} />
      </div>

      <ul
        ref={listRef}
        role="listbox"
        aria-label="Note list"
        aria-live="polite"
        onKeyDown={onListKeyDown}
        className="flex-1 space-y-1 overflow-y-auto border-t border-border px-2 pb-4 pt-4"
      >
        {!isNotesLoaded ? (
          <li className="flex items-center justify-center py-10 text-text3">
            <Loader2 size={20} className="animate-spin" aria-label="Loading notes" />
          </li>
        ) : visible.length === 0 ? (
          <li className="py-8 text-center text-xs text-text3" role="option" aria-selected={false}>
            {query.trim() ? `No notes match "${query}"` : 'No notes found'}
          </li>
        ) : (
          visible.map(note => (
            <li key={note.id} role="option" aria-selected={activeNoteId === note.id}>
              <NoteListItem
                note={note}
                isActive={activeNoteId === note.id}
                isCopied={copiedId === note.id}
                tagMap={tagMap}
                onOpen={() => openNote(note.id)}
                onDelete={e => handleDelete(e, note)}
                onCopyLink={e => copyLink(e, note)}
              />
            </li>
          ))
        )}
      </ul>
    </aside>
    </>
  )
}
