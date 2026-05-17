import { Check, Copy, Trash2 } from 'lucide-react'
import { TagBadge } from '../atoms/TagBadge'
import { timeAgo } from '../../utils/timeAgo'
import type { Note, TagRecord } from '../../types'

interface Props {
  note: Note
  isActive: boolean
  isCopied: boolean
  tagMap: Map<string, TagRecord>
  onOpen: () => void
  onDelete: (e: React.MouseEvent) => void
  onCopyLink: (e: React.MouseEvent) => void
}

export function NoteListItem({ note, isActive, isCopied, tagMap, onOpen, onDelete, onCopyLink }: Props) {
  const label = note.title || 'Untitled note'

  return (
    <div
      role="button"
      tabIndex={0}
      data-note-item
      aria-label={label}
      aria-current={isActive ? 'true' : undefined}
      onClick={onOpen}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
      }}
      className={`group sidebar-note-card flex cursor-pointer select-none items-center gap-2 rounded-lg border px-2 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
        isActive
          ? 'active border-accent/20 bg-surface shadow-sm'
          : 'border-border bg-surface2 hover:border-accent/30 hover:bg-surface'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="note-title min-w-0 truncate text-[11px] font-semibold text-text">
            {label}
          </h3>
          <span className="note-meta whitespace-nowrap text-[10px] text-text3">{timeAgo(note.updatedAt)}</span>
        </div>
        {note.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {note.tags.slice(0, 2).map(tagName => {
              const tag = tagMap.get(tagName)
              return tag ? <TagBadge key={tagName} tag={tag} variant="sm" /> : null
            })}
          </div>
        )}
      </div>

      {/* Actions — always accessible, visually hidden until hover/focus */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          title="Copy wikilink"
          aria-label={`Copy link to "${label}"`}
          onClick={onCopyLink}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text3 transition hover:bg-surface2 hover:text-text active:scale-95 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {isCopied ? <Check size={14} className="text-green-500" aria-hidden /> : <Copy size={14} aria-hidden />}
        </button>
        <button
          type="button"
          title="Delete note"
          aria-label={`Delete "${label}"`}
          onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text3 transition hover:bg-surface2 hover:text-red-400 active:scale-95 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}
