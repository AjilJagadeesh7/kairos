import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAppStore } from '../../../store/useAppStore'
import { timeAgo } from '../../../utils/timeAgo'
import { TAG_COLOR_PALETTE } from '../../../utils/kanban'
import { TagBadge } from '../../atoms/TagBadge'
import { Button } from '../../atoms/Button'
import { NoteTemplateModal } from './NoteTemplateModal'
import type { NoteTemplate } from './NoteTemplateModal'
import type { Note, TagRecord } from '../../../types'
import { Icon } from '../../../icons/Icon'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tagColor(name: string): string {
  let h = 5381
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h) ^ name.charCodeAt(i)
  return TAG_COLOR_PALETTE[Math.abs(h) % TAG_COLOR_PALETTE.length]
}

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
// Sub-components
// ---------------------------------------------------------------------------

function FolderItem({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onDoubleClick={onClick}
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-xl border border-transparent p-3 transition hover:border-border hover:bg-surface2 active:scale-95"
    >
      {/* Folder icon — mimics OS folder look */}
      <div className="relative">
        <svg width="56" height="48" viewBox="0 0 56 48" fill="none">
          {/* folder back tab */}
          <path
            d="M2 10 Q2 6 6 6 L20 6 L24 10 L50 10 Q54 10 54 14 L54 42 Q54 46 50 46 L6 46 Q2 46 2 42Z"
            className="fill-accent/25"
          />
          {/* folder front face */}
          <path
            d="M2 14 Q2 10 6 10 L50 10 Q54 10 54 14 L54 42 Q54 46 50 46 L6 46 Q2 46 2 42Z"
            className="fill-accent/40"
          />
          {/* subtle shine */}
          <path
            d="M6 12 L50 12 Q52 12 52 14 L52 18 Q52 16 50 16 L6 16 Q4 16 4 14 L4 12 Q4 12 6 12Z"
            className="fill-white/10"
          />
        </svg>
      </div>
      <span className="max-w-[80px] truncate text-center text-[12px] font-medium text-text group-hover:text-accent">
        {name}
      </span>
    </button>
  )
}

function NoteFileItem({ note, tagMap, onClick }: { note: Note; tagMap: Map<string, TagRecord>; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-xl border border-transparent p-3 transition hover:border-border hover:bg-surface2 active:scale-95"
    >
      {/* Document icon */}
      <div className="relative flex h-[48px] w-[56px] items-center justify-center">
        <svg width="40" height="48" viewBox="0 0 40 48" fill="none">
          <path
            d="M4 2 L28 2 L36 10 L36 46 Q36 46 4 46 Q4 46 4 2Z"
            className="fill-surface stroke-border"
            strokeWidth="1.5"
          />
          {/* folded corner */}
          <path d="M28 2 L28 10 L36 10Z" className="fill-surface2 stroke-border" strokeWidth="1.5" />
          {/* text lines */}
          <line x1="10" y1="20" x2="30" y2="20" className="stroke-text3" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="26" x2="30" y2="26" className="stroke-text3" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="32" x2="22" y2="32" className="stroke-text3" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <div className="flex max-w-[80px] flex-col items-center gap-0.5">
        <span className="line-clamp-2 text-center text-[12px] font-medium text-text group-hover:text-accent">
          {note.title || 'Untitled note'}
        </span>
        <span className="text-[10px] text-text3">{timeAgo(note.updatedAt)}</span>
        {note.tags.length > 0 && (
          <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
            {note.tags.slice(0, 2).map(tagName => {
              const tag = tagMap.get(tagName)
              return tag ? <TagBadge key={tagName} tag={tag} variant="sm" /> : null
            })}
          </div>
        )}
      </div>
    </button>
  )
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

  const childFolders = useMemo(() => getChildFolders(notes, currentPath), [notes, currentPath])
  const directNotes = useMemo(() => getNotesAt(notes, currentPath), [notes, currentPath])

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

          {/* New note button */}
          <Button variant="primary" size="sm" onClick={handleNew} className="inline-flex items-center gap-1.5">
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
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text3">Folders</p>
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
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text3">Notes</p>
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
