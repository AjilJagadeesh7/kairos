import { Icon } from '../../../icons/Icon'

interface CanvasNodeContextMenuProps {
  x: number
  y: number
  locked: boolean
  onLockToggle: () => void
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
}

export function CanvasNodeContextMenu({
  x, y, locked, onLockToggle, onDuplicate, onDelete, onClose,
}: CanvasNodeContextMenuProps) {
  function act(fn: () => void) { fn(); onClose() }

  return (
    <>
      <div className="fixed inset-0 z-[200]" onPointerDown={onClose} />
      <div
        className="fixed z-[201] min-w-[164px] overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-1 shadow-xl"
        style={{ left: x, top: y }}
      >
        <button type="button" onClick={() => act(onLockToggle)}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]">
          <Icon name={locked ? 'lock-open' : 'lock'} size={13} className="shrink-0" />
          {locked ? 'Unlock position' : 'Lock position'}
        </button>
        <button type="button" onClick={() => act(onDuplicate)}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]">
          <Icon name="copy" size={13} className="shrink-0" />
          Duplicate
        </button>
        <div className="my-1 border-t border-[rgb(var(--border))]" />
        <button type="button" onClick={() => act(onDelete)}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10">
          <Icon name="trash-2" size={13} className="shrink-0" />
          Delete
        </button>
      </div>
    </>
  )
}
