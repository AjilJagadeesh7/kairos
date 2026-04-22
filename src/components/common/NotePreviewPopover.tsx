import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, FileText, X } from 'lucide-react'
import { db } from '../../db/schema'
import type { Note } from '../../types'

interface NotePreviewPopoverProps {
  /** Look up by title (wikilink use-case) */
  title?: string
  /** Look up by id (graph use-case) */
  noteId?: string
  /** Screen X coordinate — popover centres on this */
  x: number
  /** Screen Y coordinate — popover appears below this */
  y: number
  onNavigate: () => void
  onClose: () => void
}

function stripMarkdown(content: string): string {
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`~\[\]]/g, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
}

export function NotePreviewPopover({
  title,
  noteId,
  x,
  y,
  onNavigate,
  onClose,
}: NotePreviewPopoverProps) {
  const [note, setNote] = useState<Note | null | undefined>(undefined)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Fetch note by id or title
  useEffect(() => {
    let cancelled = false
    const lookup = noteId
      ? db.notes.get(noteId)
      : title
        ? db.notes.filter((n) => n.title.trim().toLowerCase() === title.trim().toLowerCase()).first()
        : Promise.resolve(undefined)

    lookup.then((found) => {
      if (!cancelled) setNote(found ?? null)
    })
    return () => { cancelled = true }
  }, [noteId, title])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Close on outside click
  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = window.setTimeout(() => window.addEventListener('mousedown', onOutside), 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('mousedown', onOutside)
    }
  }, [onClose])

  const displayTitle = note?.title ?? title ?? 'Note'
  const preview = note?.content ? stripMarkdown(note.content).slice(0, 180) : null
  const hasMore = (note?.content?.length ?? 0) > 180

  const POPOVER_WIDTH = 280
  const clampedX = Math.min(
    Math.max(x - POPOVER_WIDTH / 2, 8),
    window.innerWidth - POPOVER_WIDTH - 8,
  )
  const clampedY = Math.min(y + 8, window.innerHeight - 220)

  return createPortal(
    <div
      ref={tooltipRef}
      role="dialog"
      aria-label={`Preview: ${displayTitle}`}
      style={{ left: clampedX, top: clampedY, width: POPOVER_WIDTH }}
      className="fixed z-[9999] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start gap-2 p-3 pb-2.5">
        <FileText size={14} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{displayTitle}</p>

          {note === undefined && (
            <p className="mt-1 text-xs text-text3">Loading…</p>
          )}
          {note === null && (
            <p className="mt-1 text-xs italic text-text3">Note not found</p>
          )}
          {note && note.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {note.tags.map((t) => (
                <span key={t} className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] text-text3">
                  #{t}
                </span>
              ))}
            </div>
          )}
          {note && preview && (
            <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-text2">
              {preview}{hasMore ? '…' : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded p-0.5 text-text3 transition hover:bg-surface2 hover:text-text"
        >
          <X size={13} />
        </button>
      </div>

      {/* Footer */}
      {note && (
        <div className="border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={() => { onNavigate(); onClose() }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20"
          >
            Open note <ArrowRight size={11} />
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
