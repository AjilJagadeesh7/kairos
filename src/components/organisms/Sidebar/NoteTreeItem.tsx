import { useState } from 'react'
import { NoteRow } from './NoteRow'
import { NoteAttachmentRows } from './NoteAttachmentRows'
import { useAttachmentCount } from '../../../attachments/attachmentIndex'
import { Icon } from '../../../icons/Icon'
import type { Note } from '../../../types'

interface Props {
  note: Note
  isActive: boolean
  isCopied: boolean
  depth: number
  allFolderPaths: string[]
  onOpen: () => void
  onDelete: () => void
  onCopyLink: () => void
  onMove: (folder: string) => void
  onDragStart: (noteId: string) => void
}

/**
 * Renders a note in the sidebar tree. A note with no attachments is a plain
 * NoteRow; a note WITH attachments becomes a collapsible folder (named after the
 * note) containing the note itself plus its attachment files — so attachments
 * live alongside their note inside a directory.
 */
export function NoteTreeItem(props: Props): JSX.Element {
  const { note, depth } = props
  const count = useAttachmentCount(note.id)
  const [expanded, setExpanded] = useState(false)

  if (count === 0) {
    return <NoteRow {...props} />
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v) } }}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        className="group relative flex h-[26px] cursor-pointer select-none items-center gap-1 pr-2 text-[13px] font-medium text-text transition-colors hover:bg-surface3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent/50"
      >
        <span className="relative flex w-5 shrink-0 items-center justify-center" aria-hidden>
          <Icon
            name="chevron-right"
            size={16}
            className={`absolute -left-3.5 text-text3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          />
          <Icon name={expanded ? 'folder-open' : 'folder'} size={11} className="shrink-0 text-accent/80" />
        </span>
        <span className="min-w-0 flex-1 truncate">{note.title || 'Untitled note'}</span>
      </div>

      {expanded && (
        <>
          <NoteRow {...props} depth={depth + 1} />
          <NoteAttachmentRows noteId={note.id} depth={depth + 1} />
        </>
      )}
    </>
  )
}
