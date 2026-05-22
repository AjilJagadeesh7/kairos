
import { TagBadge } from '../atoms/TagBadge'
import { useAppStore } from '../../store/useAppStore'
import { useIconRules, resolveNoteIcon } from '../../plugins/pluginContext'
import { timeAgo } from '../../utils/timeAgo'
import type { Note, TagRecord } from '../../types'
import { Icon } from '../../icons/Icon'

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
  const isPinned  = useAppStore(s => s.pinnedNoteIds.includes(note.id))
  const pinNote   = useAppStore(s => s.pinNote)
  const unpinNote = useAppStore(s => s.unpinNote)
  const iconRules = useIconRules()
  const iconRule  = resolveNoteIcon(note.title, note.tags, iconRules)
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
      className={`group flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-[5px] text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
        isActive
          ? 'bg-accent/12 text-text font-medium'
          : 'text-text2 hover:bg-surface3 hover:text-text'
      }`}
    >
      {iconRule
        ? <span className="shrink-0 text-[13px] leading-none" style={iconRule.color ? { color: iconRule.color } : undefined}>{iconRule.emoji}</span>
        : isPinned
          ? <Icon name="pin" size={12} className="shrink-0 text-accent" aria-hidden />
          : <Icon name="file-text" size={12} className={`shrink-0 ${isActive ? 'text-accent/60' : 'text-text3'}`} aria-hidden />
      }

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 truncate leading-snug">{label}</span>
          <span className="shrink-0 text-[10px] text-text3 opacity-60">{timeAgo(note.updatedAt)}</span>
        </div>
        {note.tags.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {note.tags.slice(0, 3).map(tagName => {
              const tag = tagMap.get(tagName)
              return tag ? <TagBadge key={tagName} tag={tag} variant="sm" /> : null
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          title={isPinned ? 'Unpin' : 'Pin'}
          aria-label={isPinned ? `Unpin "${label}"` : `Pin "${label}"`}
          onClick={e => { e.stopPropagation(); isPinned ? unpinNote(note.id) : pinNote(note.id) }}
          className={`flex h-6 w-6 items-center justify-center rounded transition active:scale-95 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
            isPinned ? 'text-accent hover:text-accent/70' : 'text-text3 hover:bg-surface hover:text-text'
          }`}
        >
          <Icon name="pin" size={11} aria-hidden className={isPinned ? 'fill-accent' : ''} />
        </button>
        <button
          type="button"
          title="Copy wikilink"
          aria-label={`Copy link to "${label}"`}
          onClick={onCopyLink}
          className="flex h-6 w-6 items-center justify-center rounded text-text3 transition hover:bg-surface hover:text-text active:scale-95 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {isCopied ? <Icon name="check" size={11} className="text-green-500" aria-hidden /> : <Icon name="copy" size={11} aria-hidden />}
        </button>
        <button
          type="button"
          title="Delete"
          aria-label={`Delete "${label}"`}
          onClick={onDelete}
          className="flex h-6 w-6 items-center justify-center rounded text-text3 transition hover:bg-surface hover:text-red-400 active:scale-95 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
        >
          <Icon name="trash-2" size={11} aria-hidden />
        </button>
      </div>
    </div>
  )
}
