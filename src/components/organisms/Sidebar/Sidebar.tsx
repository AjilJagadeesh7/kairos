import { Loader2, Plus, Search, X } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { useSidebarNotes } from '../../../hooks/useSidebarNotes'
import { Button } from '../../atoms/Button'
import { Dropdown } from '../../molecules/Dropdown'
import { TagFiltersDropdown } from '../../molecules/TagFiltersDropdown'
import { SearchModePills } from '../../molecules/SearchModePills'
import { SelectedFilters } from '../../molecules/SelectedFilters'
import { NoteListItem } from '../../molecules/NoteListItem'

interface Props {
  onClose?: () => void
}

export function Sidebar({ onClose }: Props): JSX.Element {
  const {
    isNotesLoaded, activeNoteId, query, setQuery, searchMode,
    allTags, tagMap, visible, copiedId, selectedTagFilters, setSelectedTagFilters,
    openNote, createAndOpen, handleDelete, copyLink,
  } = useSidebarNotes(onClose)

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface2">
      <div className="sidebar-header flex items-center gap-2 border-b border-border px-3 py-3">
        <span className="flex-1 text-xs font-semibold uppercase tracking-widest text-text3">Notes</span>
        <Button
          variant="primary"
          size="xs"
          onClick={createAndOpen}
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

      <div className="sidebar-top border-b border-border px-3 py-3">
        <div className="relative mb-3">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchMode === 'semantic' ? 'Semantic search…' : 'Search notes…'}
            className="sidebar-search w-full rounded-2xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text outline-none focus:border-text2 placeholder:text-text3"
          />
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
          <SearchModePills
            searchMode={searchMode}
            onSearchModeChange={mode => useAppStore.getState().setSearchMode(mode)}
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

        <SelectedFilters selectedTagFilters={selectedTagFilters} tagMap={tagMap} />
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto border-t border-border px-2 pb-4 pt-4">
        {!isNotesLoaded ? (
          <li className="flex items-center justify-center py-10 text-text3">
            <Loader2 size={20} className="animate-spin" />
          </li>
        ) : visible.length === 0 ? (
          <li className="py-8 text-center text-xs text-text3">No notes found</li>
        ) : (
          visible.map(note => (
            <li key={note.id}>
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
  )
}
