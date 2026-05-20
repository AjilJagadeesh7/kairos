import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { useSidebarNotes } from '../../../hooks/useSidebarNotes'
import { buildFolderTree, getAllFolderPaths } from '../../../utils/folderTree'
import { Button } from '../../atoms/Button'
import { SearchModePills } from '../../molecules/SearchModePills'
import { NoteListItem } from '../../molecules/NoteListItem'
import { NoteTemplateModal } from '../Notes/NoteTemplateModal'
import { FolderTree } from './FolderTree'
import type { NoteTemplate } from '../Notes/NoteTemplateModal'
import type { Note } from '../../../types'

interface Props {
  onClose?: () => void
}

export function Sidebar({ onClose }: Props): JSX.Element {
  const listRef = useRef<HTMLUListElement>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateFolder, setTemplateFolder] = useState<string | undefined>()

  const createNote      = useAppStore(s => s.createNote)
  const folderList      = useAppStore(s => s.folderList)
  const moveNoteToFolder = useAppStore(s => s.moveNoteToFolder)
  const createFolder    = useAppStore(s => s.createFolder)
  const renameFolder    = useAppStore(s => s.renameFolder)
  const deleteFolder    = useAppStore(s => s.deleteFolder)
  const deleteNoteById  = useAppStore(s => s.deleteNoteById)
  const navigate        = useNavigate()

  const {
    isNotesLoaded, notes, activeNoteId, query, setQuery, searchMode,
    tagMap, visible, copiedId,
    openNote, handleDelete, copyLink,
  } = useSidebarNotes(onClose)

  // Only show tree when not searching
  const isSearching = query.trim().length > 0

  const folderTree = useMemo(
    () => buildFolderTree(notes, folderList),
    [notes, folderList],
  )

  const allFolderPaths = useMemo(() => getAllFolderPaths(folderTree), [folderTree])

  function openNewNoteTemplates(folder?: string) {
    setTemplateFolder(folder)
    setShowTemplates(true)
  }

  function handleTemplateSelect(template: NoteTemplate) {
    setShowTemplates(false)
    void createNote(
      template.id === 'blank'
        ? { folder: templateFolder }
        : { title: template.title, content: template.content, folder: templateFolder },
    ).then(id => {
      navigate(`/notes/${id}`)
      onClose?.()
    })
  }

  function handleDeleteNote(note: Note) {
    void import('../../../store/useConfirmStore').then(({ useConfirmStore }) => {
      void useConfirmStore.getState()
        .confirm({
          title: `Delete "${note.title || 'Untitled note'}"?`,
          message: 'This cannot be undone.',
          confirmLabel: 'Delete',
          danger: true,
        })
        .then(ok => { if (ok) void deleteNoteById(note.id) })
    })
  }

  // Arrow-key navigation within the flat search results list
  function onListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    const items = listRef.current?.querySelectorAll<HTMLElement>('[data-note-item]')
    if (!items || items.length === 0) return
    const current = document.activeElement as HTMLElement
    const idx = Array.from(items).indexOf(current)
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(idx + 1, items.length - 1)]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(idx - 1, 0)]?.focus() }
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
        {/* ── Header ── */}
        <div className="sidebar-header flex items-center gap-2 border-b border-border px-3 py-3">
          <span className="flex-1 text-xs font-semibold uppercase tracking-widest text-text3">Files</span>
          <Button
            variant="primary"
            size="xs"
            onClick={() => openNewNoteTemplates()}
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

        {/* ── Search input ── */}
        <div className="border-b border-border px-3 py-3">
          <div className="relative mb-3">
            <Search size={13} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchMode === 'semantic' ? 'Semantic search…' : 'Search files…'}
              aria-label="Search notes"
              className="sidebar-search w-full rounded-2xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text outline-none focus:border-text2 focus-visible:ring-2 focus-visible:ring-accent/30 placeholder:text-text3"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text3 transition hover:text-text"
              >
                <X size={13} aria-hidden />
              </button>
            )}
          </div>

          {/* Search mode pills + count (only when searching) */}
          {isSearching && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <SearchModePills
                searchMode={searchMode}
                onSearchModeChange={mode => useAppStore.getState().setSearchMode(mode)}
              />
              <span className="sidebar-note-count ml-auto rounded-full bg-surface3 px-2 py-1 text-[10px] text-text3">
                {visible.length} {visible.length === 1 ? 'note' : 'notes'}
              </span>
            </div>
          )}
        </div>

        {/* ── Body: tree view or search results ── */}
        <div className="flex-1 overflow-y-auto pb-4 pt-2">
          {!isNotesLoaded ? (
            <div className="flex items-center justify-center py-10 text-text3">
              <Loader2 size={20} className="animate-spin" aria-label="Loading notes" />
            </div>
          ) : isSearching ? (
            // Flat search results
            <ul
              ref={listRef}
              role="listbox"
              aria-label="Search results"
              aria-live="polite"
              onKeyDown={onListKeyDown}
              className="space-y-1 px-2"
            >
              {visible.length === 0 ? (
                <li className="py-8 text-center text-xs text-text3" role="option" aria-selected={false}>
                  No notes match &ldquo;{query}&rdquo;
                </li>
              ) : (
                visible.map(note => (
                  <li key={note.id} role="option" aria-selected={activeNoteId === note.id}>
                    {/* Folder path badge under title */}
                    <div className="group relative">
                      <NoteListItem
                        note={note}
                        isActive={activeNoteId === note.id}
                        isCopied={copiedId === note.id}
                        tagMap={tagMap}
                        onOpen={() => openNote(note.id)}
                        onDelete={e => handleDelete(e, note)}
                        onCopyLink={e => copyLink(e, note)}
                      />
                      {note.folder && (
                        <span className="pointer-events-none absolute bottom-1 right-10 text-[10px] text-text3">
                          {note.folder}
                        </span>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          ) : (
            // Folder tree
            <div className="px-1">
              <FolderTree
                root={folderTree}
                activeNoteId={activeNoteId}
                copiedId={copiedId}
                tagMap={tagMap}
                allFolderPaths={allFolderPaths}
                onOpenNote={id => { navigate(`/notes/${id}`); onClose?.() }}
                onDeleteNote={handleDeleteNote}
                onCopyLink={note => {
                  void navigator.clipboard.writeText(`[[${note.title}]]`)
                  // copiedId state is in useSidebarNotes — reuse its copyLink
                  copyLink({ stopPropagation: () => {} } as React.MouseEvent, note)
                }}
                onMoveNote={moveNoteToFolder}
                onCreateNote={folder => openNewNoteTemplates(folder)}
                onCreateFolder={(parentPath, name) => {
                  const path = parentPath ? `${parentPath}/${name}` : name
                  void createFolder(path)
                }}
                onRenameFolder={renameFolder}
                onDeleteFolder={path => {
                  void import('../../../store/useConfirmStore').then(({ useConfirmStore }) => {
                    void useConfirmStore.getState()
                      .confirm({
                        title: `Delete folder "${path}"?`,
                        message: 'Notes inside will be moved to the root. This cannot be undone.',
                        confirmLabel: 'Delete',
                        danger: true,
                      })
                      .then(ok => { if (ok) void deleteFolder(path) })
                  })
                }}
              />
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
