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
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpen() }}
      className={`group sidebar-note-card flex cursor-pointer select-none items-center gap-2 rounded-lg border px-2 py-2 transition-colors ${
        isActive
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
            {note.tags.slice(0, 2).map(tagName => {
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
          onClick={onCopyLink}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text3 transition hover:bg-surface2 hover:text-text active:scale-95"
        >
          {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
        <button
          type="button"
          title="Delete note"
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text3 transition hover:bg-surface2 hover:text-red-400 active:scale-95"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
