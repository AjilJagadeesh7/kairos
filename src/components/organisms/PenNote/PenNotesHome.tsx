import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { usePenNoteStore } from '../../../store/usePenNoteStore'
import { timeAgo } from '../../../utils/timeAgo'
import { Button } from '../../atoms/Button'
import { SectionLabel } from '../../atoms/SectionLabel'
import { Icon } from '../../../icons/Icon'
import type { PenNote } from '../../../types'

// ---------------------------------------------------------------------------
// Folder helpers (pen notes carry a vault-relative `folder` path, like notes)
// ---------------------------------------------------------------------------

/** Direct child folder names at a given path prefix */
function getChildFolders(notes: PenNote[], explicit: string[], atPath: string): string[] {
  const seen = new Set<string>()
  const consider = (f: string) => {
    if (!f) return
    if (atPath === '') seen.add(f.split('/')[0])
    else if (f === atPath) { /* exact, no child */ }
    else if (f.startsWith(atPath + '/')) seen.add(f.slice(atPath.length + 1).split('/')[0])
  }
  for (const n of notes) consider(n.folder?.trim() ?? '')
  for (const f of explicit) consider(f.trim())
  return [...seen].sort((a, b) => a.localeCompare(b))
}

/** Pen notes that live directly at the given path (exact match) */
function getNotesAt(notes: PenNote[], atPath: string): PenNote[] {
  return notes
    .filter(n => (n.folder?.trim() ?? '') === atPath)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FolderItem({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-xl border border-transparent p-3 transition hover:border-border hover:bg-surface2 active:scale-95"
    >
      <svg width="56" height="48" viewBox="0 0 56 48" fill="none">
        <path d="M2 10 Q2 6 6 6 L20 6 L24 10 L50 10 Q54 10 54 14 L54 42 Q54 46 50 46 L6 46 Q2 46 2 42Z" className="fill-accent/25" />
        <path d="M2 14 Q2 10 6 10 L50 10 Q54 10 54 14 L54 42 Q54 46 50 46 L6 46 Q2 46 2 42Z" className="fill-accent/40" />
      </svg>
      <span className="max-w-[80px] truncate text-center text-[12px] font-medium text-text group-hover:text-accent">{name}</span>
    </button>
  )
}

function PenNoteFileItem({ note, onClick }: { note: PenNote; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-xl border border-transparent p-3 transition hover:border-border hover:bg-surface2 active:scale-95"
    >
      <div className="relative flex h-[48px] w-[56px] items-center justify-center">
        <svg width="40" height="48" viewBox="0 0 40 48" fill="none">
          <path d="M4 2 L28 2 L36 10 L36 46 Q36 46 4 46 Q4 46 4 2Z" className="fill-surface stroke-border" strokeWidth="1.5" />
          <path d="M28 2 L28 10 L36 10Z" className="fill-surface2 stroke-border" strokeWidth="1.5" />
        </svg>
        <Icon name="pen-line" size={16} className="absolute text-accent" />
      </div>
      <div className="flex max-w-[80px] flex-col items-center gap-0.5">
        <span className="line-clamp-2 text-center text-[12px] font-medium text-text group-hover:text-accent">
          {note.title || 'Untitled pen note'}
        </span>
        <span className="text-[10px] text-text3">{timeAgo(note.updatedAt)}</span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// PenNotesHome
// ---------------------------------------------------------------------------

export function PenNotesHome() {
  const navigate = useNavigate()
  const penNotes = usePenNoteStore(s => s.penNotes)
  const folders  = usePenNoteStore(s => s.folders)
  const create   = usePenNoteStore(s => s.create)
  // Current directory path — "" = root
  const [currentPath, setCurrentPath] = useState('')

  const childFolders = useMemo(() => getChildFolders(penNotes, folders, currentPath), [penNotes, folders, currentPath])
  const directNotes  = useMemo(() => getNotesAt(penNotes, currentPath), [penNotes, currentPath])

  const isEmpty = childFolders.length === 0 && directNotes.length === 0
  const breadcrumbs = currentPath ? currentPath.split('/') : []

  const handleNew = () => navigate(`/pennote/${create('Untitled pen note', { folder: currentPath || undefined })}`)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg">
      {/* ── Toolbar / breadcrumb bar ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-2">
        <button
          type="button"
          disabled={!currentPath}
          onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text3 transition hover:bg-surface2 hover:text-text disabled:pointer-events-none disabled:opacity-30"
          title="Go up"
        >
          <Icon name="arrow-left" size={14} />
        </button>

        <nav className="flex min-w-0 flex-1 items-center gap-0.5 text-[12px]">
          <button
            onClick={() => setCurrentPath('')}
            className={`rounded px-1.5 py-0.5 transition hover:bg-surface2 hover:text-text ${currentPath === '' ? 'font-semibold text-text' : 'text-text2'}`}
          >
            Pen notes
          </button>
          {breadcrumbs.map((seg, i) => {
            const path = breadcrumbs.slice(0, i + 1).join('/')
            const isLast = i === breadcrumbs.length - 1
            return (
              <span key={path} className="flex items-center gap-0.5">
                <Icon name="chevron-right" size={10} className="text-text3" />
                <button
                  onClick={() => setCurrentPath(path)}
                  className={`rounded px-1.5 py-0.5 transition hover:bg-surface2 hover:text-text ${isLast ? 'font-semibold text-text' : 'text-text2'}`}
                >
                  {seg}
                </button>
              </span>
            )
          })}
        </nav>

        <span className="shrink-0 text-[11px] text-text3">{childFolders.length + directNotes.length} items</span>

        <Button variant="primary" size="md" onClick={handleNew} className="inline-flex items-center gap-1.5">
          <Icon name="plus" size={14} /> New pen note
        </Button>
      </div>

      {/* ── File grid ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {isEmpty ? (
          <button
            onClick={handleNew}
            className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-16 text-center text-text3 transition hover:border-accent hover:text-accent"
          >
            <Icon name="pen-line" size={28} />
            <div>
              <p className="font-medium">No pen notes yet</p>
              <p className="mt-1 text-sm">Click to create your first pen note</p>
            </div>
          </button>
        ) : (
          <div className="space-y-6">
            {childFolders.length > 0 && (
              <div>
                {directNotes.length > 0 && <SectionLabel className="mb-3">Folders</SectionLabel>}
                <div className="flex flex-wrap gap-1">
                  {childFolders.map(name => (
                    <FolderItem
                      key={name}
                      name={name}
                      onClick={() => setCurrentPath(currentPath ? `${currentPath}/${name}` : name)}
                    />
                  ))}
                </div>
              </div>
            )}

            {directNotes.length > 0 && (
              <div>
                {childFolders.length > 0 && <SectionLabel className="mb-3">Pen notes</SectionLabel>}
                <div className="flex flex-wrap gap-1">
                  {directNotes.map(note => (
                    <PenNoteFileItem key={note.id} note={note} onClick={() => navigate(`/pennote/${note.id}`)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
