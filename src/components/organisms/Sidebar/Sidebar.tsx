import { useEffect, useMemo, useState } from 'react'
import { useLoaderStore } from '../../../store/useLoaderStore'
import { useNavigate } from 'react-router-dom'

import { useAppStore } from '../../../store/useAppStore'
import { useSidebarNotes } from '../../../hooks/useSidebarNotes'
import { useBulkDelete } from '../../../hooks/useBulkDelete'
import { useSelectionStore, useIsSelecting, exitSelection } from '../../../store/useSelectionStore'
import { useSortPref } from '../../../store/useSortStore'
import { buildFolderTree, getAllFolderPaths } from '../../../utils/folderTree'
import { sortItems } from '../../../utils/sortItems'
import { SearchModePills } from '../../molecules/SearchModePills'
import { SelectionToolbar } from '../../molecules/SelectionToolbar'
import { SortMenu } from '../../molecules/SortMenu'
import { VirtualNoteList } from '../../molecules/VirtualNoteList'
import { NoteTemplateModal } from '../Notes/NoteTemplateModal'
import { FolderTree } from './FolderTree'
import { IconButton } from '../../atoms/IconButton'
import { SectionLabel } from '../../atoms/SectionLabel'
import type { NoteTemplate } from '../../../types'
import type { Note } from '../../../types'
import { Icon } from '../../../icons/Icon'
import { SlotRenderer } from '../../molecules/SlotRenderer'

interface Props {
  onClose?: () => void
}

export function Sidebar({ onClose }: Props): JSX.Element {
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateFolder, setTemplateFolder] = useState<string | undefined>()
  const [creatingRootFolder, setCreatingRootFolder] = useState(false)

  const createNote      = useAppStore(s => s.createNote)
  const folderList      = useAppStore(s => s.folderList)
  const moveNoteToFolder = useAppStore(s => s.moveNoteToFolder)
  const createFolder    = useAppStore(s => s.createFolder)
  const renameFolder    = useAppStore(s => s.renameFolder)
  const deleteFolder    = useAppStore(s => s.deleteFolder)
  const deleteNoteById  = useAppStore(s => s.deleteNoteById)
  const pinnedNoteIds   = useAppStore(s => s.pinnedNoteIds)
  const loadNotes       = useAppStore(s => s.loadNotes)
  const isRefreshing    = useLoaderStore(s => Boolean(s.tasks['load-notes']))
  const navigate        = useNavigate()

  const {
    isNotesLoaded, notes, activeNoteId, query, setQuery, searchMode,
    tagMap, visible, copiedId,
    openNote, handleDelete, copyLink,
  } = useSidebarNotes(onClose)

  useEffect(() => {
    const handler = (e: Event) => {
      const q = (e as CustomEvent<{ query: string }>).detail?.query
      if (q) setQuery(q)
    }
    window.addEventListener('mv:search', handler)
    return () => window.removeEventListener('mv:search', handler)
  }, [setQuery])

  // Only show tree when not searching
  const isSearching = query.trim().length > 0

  const sortPref = useSortPref('notes')

  const folderTree = useMemo(
    () => buildFolderTree(notes, folderList, sortPref),
    [notes, folderList, sortPref],
  )

  const allFolderPaths = useMemo(() => getAllFolderPaths(folderTree), [folderTree])

  const pinnedNotes = useMemo(
    () => pinnedNoteIds.map(id => notes.find(n => n.id === id)).filter(Boolean) as typeof notes,
    [pinnedNoteIds, notes],
  )

  // Search results follow the sort preference, with pinned notes surfaced first.
  const sortedVisible = useMemo(
    () => sortItems(visible, sortPref, n => n.title || 'Untitled note')
      .sort((a, b) => {
        const ap = pinnedNoteIds.includes(a.id) ? 0 : 1
        const bp = pinnedNoteIds.includes(b.id) ? 0 : 1
        return ap - bp
      }),
    [visible, pinnedNoteIds, sortPref],
  )

  // ── Multi-select ──
  const isSelecting    = useIsSelecting('notes')
  const enterSelect    = useSelectionStore(s => s.enter)
  const setOrder       = useSelectionStore(s => s.setOrder)
  const deleteSelected = useBulkDelete({ scope: 'notes', noun: 'note', remove: deleteNoteById })

  // Selectable ids track whatever the list is currently showing, so select-all
  // never reaches past the filtered set.
  const selectableIds = useMemo(
    () => (isSearching
      ? sortedVisible
      : sortItems(notes, sortPref, n => n.title || 'Untitled note')
    ).map(n => n.id),
    [isSearching, sortedVisible, notes, sortPref],
  )

  useEffect(() => { if (isSelecting) setOrder(selectableIds) }, [isSelecting, selectableIds, setOrder])
  useEffect(() => () => exitSelection('notes'), [])

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
        <div className="sidebar-header flex items-center gap-1 border-b border-border px-3 py-3">
          <SectionLabel className="flex-1">Files</SectionLabel>
          <IconButton icon="plus"        label="New note"       size="xs" onClick={() => openNewNoteTemplates()} />
          <IconButton icon="folder-plus" label="New folder"     size="xs" onClick={() => setCreatingRootFolder(true)} />
          {selectableIds.length > 0 && (
            <IconButton
              icon="check-square"
              label={isSelecting ? 'Exit selection' : 'Select notes'}
              size="xs"
              onClick={() => (isSelecting ? exitSelection('notes') : enterSelect('notes', selectableIds))}
              className={isSelecting ? 'bg-accent/15 text-accent' : ''}
            />
          )}
          <SortMenu scope="notes" />
          <IconButton icon="refresh-cw"  label="Refresh notes"  size="xs" onClick={() => void loadNotes()} disabled={isRefreshing}
            iconClassName={isRefreshing ? 'animate-spin' : ''} />
          {onClose && (
            <IconButton icon="x" label="Close sidebar" size="xs" onClick={onClose} className="xl:hidden" />
          )}
          <SlotRenderer slot="sidebar:header:end" props={{}} />
        </div>

        {/* ── Search input ── */}
        <div className="border-b border-border px-3 py-3">
          <div className="relative mb-3">
            <Icon name="search" size={13} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
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
                <Icon name="x" size={13} aria-hidden />
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

        {/* ── Selection bar ── */}
        {isSelecting && (
          <SelectionToolbar
            scope="notes"
            noun="note"
            onDelete={deleteSelected}
            onExit={() => exitSelection('notes')}
          />
        )}

        {/* ── Body: tree view or search results ── */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {!isNotesLoaded ? (
            <div className="flex items-center justify-center py-10 text-text3">
              <Icon name="loader-2" size={20} className="animate-spin" aria-label="Loading notes" />
            </div>
          ) : isSearching ? (
            // Virtualized flat search results — DOM stays constant regardless of vault size
            <VirtualNoteList
              notes={sortedVisible}
              activeNoteId={activeNoteId}
              copiedId={copiedId}
              tagMap={tagMap}
              query={query}
              onOpen={openNote}
              onDelete={handleDelete}
              onCopyLink={copyLink}
            />
          ) : (
            // Folder tree
            <div className="h-full overflow-y-auto pb-4 pt-2 px-1">
              <FolderTree
                root={folderTree}
                activeNoteId={activeNoteId}
                copiedId={copiedId}
                tagMap={tagMap}
                allFolderPaths={allFolderPaths}
                pinnedNotes={pinnedNotes}
                creatingRootFolder={creatingRootFolder}
                onCreatingRootFolderChange={setCreatingRootFolder}
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
        <SlotRenderer slot="sidebar:footer" props={{}} className="border-t border-border" />
      </aside>
    </>
  )
}
