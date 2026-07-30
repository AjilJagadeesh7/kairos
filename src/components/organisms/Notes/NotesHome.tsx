import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAppStore } from '../../../store/useAppStore'
import { useSortPref } from '../../../store/useSortStore'
import { sortItems, sortNames } from '../../../utils/sortItems'
import { tagColorFromName as tagColor } from '../../../utils/kanban'
import { Button } from '../../atoms/Button'
import { NoteTemplateModal } from './NoteTemplateModal'
import { FolderItem, NoteFileItem } from './NotesHomeTiles'
import { SortMenu } from '../../molecules/SortMenu'
import { SectionLabel } from '../../atoms/SectionLabel'
import type { NoteTemplate } from '../../../types'
import type { Note, TagRecord } from '../../../types'
import { Icon } from '../../../icons/Icon'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Direct child folder names at a given path prefix */
function getChildFolders(notes: Note[], atPath: string): string[] {
  const seen = new Set<string>()
  for (const n of notes) {
    const f = n.folder?.trim() ?? ''
    if (atPath === '') {
      // top-level: any note with a non-empty folder
      if (f) {
        const top = f.split('/')[0]
        seen.add(top)
      }
    } else {
      // nested: folder must start with atPath + "/"
      if (f.startsWith(atPath + '/')) {
        const rest = f.slice(atPath.length + 1)
        seen.add(rest.split('/')[0])
      }
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}

/** Notes that live directly at the given path (exact match) */
function getNotesAt(notes: Note[], atPath: string): Note[] {
  return notes.filter(n => (n.folder?.trim() ?? '') === atPath)
}

// ---------------------------------------------------------------------------
// NotesHome
// ---------------------------------------------------------------------------

export function NotesHome() {
  const navigate = useNavigate()
  const notes = useAppStore(s => s.notes)
  const createNote = useAppStore(s => s.createNote)
  const [showTemplates, setShowTemplates] = useState(false)
  // Current directory path — "" = root
  const [currentPath, setCurrentPath] = useState('')

  const tagMap = useMemo(() => {
    const map = new Map<string, TagRecord>()
    notes.forEach(n => n.tags.forEach(name => {
      if (!map.has(name)) map.set(name, { name, color: tagColor(name), createdAt: '' })
    }))
    return map
  }, [notes])

  const sortPref = useSortPref('notes')

  const childFolders = useMemo(
    () => sortNames(getChildFolders(notes, currentPath), sortPref),
    [notes, currentPath, sortPref],
  )
  const directNotes = useMemo(
    () => sortItems(getNotesAt(notes, currentPath), sortPref, n => n.title || 'Untitled note'),
    [notes, currentPath, sortPref],
  )

  const isEmpty = childFolders.length === 0 && directNotes.length === 0

  function navigateInto(folderName: string) {
    setCurrentPath(currentPath ? `${currentPath}/${folderName}` : folderName)
  }

  function navigateTo(path: string) {
    setCurrentPath(path)
  }

  // Breadcrumb segments
  const breadcrumbs = currentPath ? currentPath.split('/') : []

  const handleNew = () => setShowTemplates(true)

  const handleTemplateSelect = (template: NoteTemplate) => {
    setShowTemplates(false)
    void createNote(
      template.id === 'blank'
        ? { folder: currentPath || undefined }
        : { title: template.title, content: template.content, folder: currentPath || undefined }
    ).then(id => navigate(`/notes/${id}`))
  }

  return (
    <>
      {showTemplates && (
        <NoteTemplateModal onSelect={handleTemplateSelect} onClose={() => setShowTemplates(false)} />
      )}

      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg">
        {/* ── Toolbar / breadcrumb bar ── */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-2">
          {/* Back button */}
          <button
            type="button"
            disabled={!currentPath}
            onClick={() => {
              const parts = currentPath.split('/')
              parts.pop()
              setCurrentPath(parts.join('/'))
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text3 transition hover:bg-surface2 hover:text-text disabled:pointer-events-none disabled:opacity-30"
            title="Go up"
          >
            <Icon name="arrow-left" size={14} />
          </button>

          {/* Breadcrumb */}
          <nav className="flex min-w-0 flex-1 items-center gap-0.5 text-[12px]">
            <button
              onClick={() => navigateTo('')}
              className={`rounded px-1.5 py-0.5 transition hover:bg-surface2 hover:text-text ${currentPath === '' ? 'font-semibold text-text' : 'text-text2'}`}
            >
              Notes
            </button>
            {breadcrumbs.map((seg, i) => {
              const path = breadcrumbs.slice(0, i + 1).join('/')
              const isLast = i === breadcrumbs.length - 1
              return (
                <span key={path} className="flex items-center gap-0.5">
                  <Icon name="chevron-right" size={10} className="text-text3" />
                  <button
                    onClick={() => navigateTo(path)}
                    className={`rounded px-1.5 py-0.5 transition hover:bg-surface2 hover:text-text ${isLast ? 'font-semibold text-text' : 'text-text2'}`}
                  >
                    {seg}
                  </button>
                </span>
              )
            })}
          </nav>

          {/* Item count */}
          <span className="shrink-0 text-[11px] text-text3">
            {childFolders.length + directNotes.length} items
          </span>

          <SortMenu scope="notes" variant="button" className="shrink-0" />

          {/* New note button */}
          <Button variant="primary" size="md" onClick={handleNew} className="inline-flex items-center gap-1.5">
            <Icon name="plus" size={14} /> New note
          </Button>
        </div>

        {/* ── File grid ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {isEmpty ? (
            <button
              onClick={handleNew}
              className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-16 text-center text-text3 transition hover:border-accent hover:text-accent"
            >
              <Icon name="book-open" size={28} />
              <div>
                <p className="font-medium">No notes yet</p>
                <p className="mt-1 text-sm">Click to create your first note</p>
              </div>
            </button>
          ) : (
            <div className="space-y-6">
              {/* Folders section */}
              {childFolders.length > 0 && (
                <div>
                  {directNotes.length > 0 && (
                    <SectionLabel className="mb-3">Folders</SectionLabel>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {childFolders.map(name => (
                      <FolderItem
                        key={name}
                        name={name}
                        onClick={() => navigateInto(name)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Notes section */}
              {directNotes.length > 0 && (
                <div>
                  {childFolders.length > 0 && (
                    <SectionLabel className="mb-3">Notes</SectionLabel>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {directNotes.map(note => (
                      <NoteFileItem
                        key={note.id}
                        note={note}
                        tagMap={tagMap}
                        onClick={() => navigate(`/notes/${note.id}`)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
