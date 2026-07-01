import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../icons/Icon'

interface Props {
  x: number
  y: number
  onOpen: () => void
  onRename: () => void
  onDownload: () => void
  onDelete: () => void
  onClose: () => void
}

/** Right-click menu for an attachment row on the Attachments page. */
export function AttachmentContextMenu({ x, y, onOpen, onRename, onDownload, onDelete, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const left = Math.min(x, window.innerWidth - 208)
  const top  = Math.min(y, window.innerHeight - 180)
  const item = 'flex w-full items-center gap-2 px-3 py-2 text-xs text-text transition hover:bg-surface2'

  return createPortal(
    <div
      ref={ref}
      role="menu"
      onContextMenu={e => e.preventDefault()}
      className="fixed z-[9999] min-w-[190px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      style={{ left, top }}
    >
      <button type="button" role="menuitem" className={item}
        onClick={e => { e.stopPropagation(); onOpen(); onClose() }}>
        <Icon name="eye" size={13} aria-hidden /> Open
      </button>
      <button type="button" role="menuitem" className={item}
        onClick={e => { e.stopPropagation(); onRename(); onClose() }}>
        <Icon name="pencil" size={13} aria-hidden /> Rename
      </button>
      <button type="button" role="menuitem" className={item}
        onClick={e => { e.stopPropagation(); onDownload(); onClose() }}>
        <Icon name="download" size={13} aria-hidden /> Download
      </button>

      <div className="my-0.5 border-t border-border/50" />

      <button type="button" role="menuitem"
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 transition hover:bg-surface2"
        onClick={e => { e.stopPropagation(); onDelete(); onClose() }}>
        <Icon name="trash-2" size={13} aria-hidden /> Delete
      </button>
    </div>,
    document.body,
  )
}
