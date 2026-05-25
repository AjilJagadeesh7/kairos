import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../icons/Icon'
import type { Note } from '../../../types'

interface NoteContextMenuProps {
  x: number
  y: number
  note: Note
  isPinned: boolean
  isCopied: boolean
  allFolderPaths: string[]
  onPin: () => void
  onCopyLink: () => void
  onOpenInNewTab: () => void
  onMove: (folder: string) => void
  onDelete: () => void
  onClose: () => void
}

export function NoteContextMenu({
  x, y, note, isPinned, isCopied, allFolderPaths,
  onPin, onCopyLink, onOpenInNewTab, onMove, onDelete, onClose,
}: NoteContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [showMove, setShowMove] = useState(false)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const left = Math.min(x, window.innerWidth - 208)
  const top  = Math.min(y, window.innerHeight - 260)

  return createPortal(
    <div
      ref={ref}
      role="menu"
      onContextMenu={e => e.preventDefault()}
      className="fixed z-[9999] min-w-[190px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      style={{ left, top }}
    >
      <button type="button" role="menuitem"
        onClick={e => { e.stopPropagation(); onPin(); onClose() }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text transition hover:bg-surface2"
      >
        <Icon name="pin" size={13} aria-hidden className={isPinned ? 'fill-accent text-accent' : ''} />
        {isPinned ? 'Unpin' : 'Pin'}
      </button>

      <button type="button" role="menuitem"
        onClick={e => { e.stopPropagation(); setShowMove(v => !v) }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text transition hover:bg-surface2"
      >
        <Icon name="folder-input" size={13} aria-hidden />
        Move to folder
        <Icon name="chevron-right" size={11} className="ml-auto text-text3" aria-hidden />
      </button>

      {showMove && (
        <div className="max-h-40 overflow-y-auto border-t border-border/50">
          {[{ label: '/ (root)', value: '' }, ...allFolderPaths.map(p => ({ label: p, value: p }))]
            .filter(o => o.value !== (note.folder ?? ''))
            .map(o => (
              <button key={o.value} type="button" role="menuitem"
                onClick={e => { e.stopPropagation(); onMove(o.value); onClose() }}
                className="flex w-full items-center gap-2 px-4 py-1.5 text-xs text-text2 transition hover:bg-surface2"
              >
                <Icon name="folder" size={11} aria-hidden />
                {o.label}
              </button>
            ))
          }
        </div>
      )}

      <button type="button" role="menuitem"
        onClick={e => { e.stopPropagation(); onCopyLink(); onClose() }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text transition hover:bg-surface2"
      >
        {isCopied
          ? <Icon name="check" size={13} className="text-green-500" aria-hidden />
          : <Icon name="copy" size={13} aria-hidden />
        }
        Copy wikilink
      </button>

      <button type="button" role="menuitem"
        onClick={e => { e.stopPropagation(); onOpenInNewTab(); onClose() }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text transition hover:bg-surface2"
      >
        <Icon name="external-link" size={13} aria-hidden />
        Open in new tab
      </button>

      <div className="my-0.5 border-t border-border/50" />

      <button type="button" role="menuitem"
        onClick={e => { e.stopPropagation(); onDelete(); onClose() }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 transition hover:bg-surface2"
      >
        <Icon name="trash-2" size={13} aria-hidden />
        Delete
      </button>
    </div>,
    document.body,
  )
}
