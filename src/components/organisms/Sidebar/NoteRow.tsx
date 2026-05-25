import { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { usePaneStore } from '../../../store/usePaneStore'
import { useIconRules, resolveNoteIcon } from '../../../plugins/pluginContext'
import { NoteContextMenu } from './NoteContextMenu'
import { Icon } from '../../../icons/Icon'
import type { Note } from '../../../types'

interface NoteRowProps {
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

export function NoteRow({
  note, isActive, isCopied, depth, allFolderPaths,
  onOpen, onDelete, onCopyLink, onMove, onDragStart,
}: NoteRowProps) {
  const label     = note.title || 'Untitled note'
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const isPinned  = useAppStore(s => s.pinnedNoteIds.includes(note.id))
  const pinNote   = useAppStore(s => s.pinNote)
  const unpinNote = useAppStore(s => s.unpinNote)
  const iconRules = useIconRules()
  const iconRule  = resolveNoteIcon(note.title, note.tags, iconRules)

  function handleOpenInNewTab() {
    const { focusedPaneId, openInNewTab } = usePaneStore.getState()
    openInNewTab(focusedPaneId, `/notes/${note.id}`, note.title || 'Note')
    onOpen()
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        data-note-item
        aria-label={label}
        aria-current={isActive ? 'true' : undefined}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('mindvault/noteId', note.id)
          onDragStart(note.id)
        }}
        onClick={onOpen}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        className={`group relative flex h-[26px] cursor-pointer select-none items-center gap-1.5 pr-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent/50 ${
          isActive ? 'bg-accent/15 text-text' : 'text-text2 hover:bg-surface3 hover:text-text'
        }`}
      >
        <span
          className="relative flex w-5 shrink-0 items-center justify-center"
          aria-hidden
          style={iconRule?.color ? { color: iconRule.color } : undefined}
        >
          {iconRule
            ? <span className="text-[12px] leading-none">{iconRule.emoji}</span>
            : isPinned
              ? <Icon name="pin" size={11} className="text-accent" />
              : <Icon name="file-text" size={11} className={isActive ? 'text-accent/60' : 'text-text3'} />
          }
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </div>

      {ctxMenu && (
        <NoteContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          note={note}
          isPinned={isPinned}
          isCopied={isCopied}
          allFolderPaths={allFolderPaths}
          onPin={() => isPinned ? unpinNote(note.id) : pinNote(note.id)}
          onCopyLink={onCopyLink}
          onOpenInNewTab={handleOpenInNewTab}
          onMove={onMove}
          onDelete={onDelete}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}
