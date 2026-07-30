import { TagBadge } from '../../atoms/TagBadge'
import { timeAgo } from '../../../utils/timeAgo'
import type { Note, TagRecord } from '../../../types'

// The file-browser tiles used by NotesHome. Split out of NotesHome so that file
// stays under the 300-line limit — these are presentational and hold no state.

export function FolderItem({ name, onClick }: { name: string; onClick: () => void }): JSX.Element {
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

interface NoteFileItemProps {
  note: Note
  tagMap: Map<string, TagRecord>
  onClick: () => void
}

export function NoteFileItem({ note, tagMap, onClick }: NoteFileItemProps): JSX.Element {
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
