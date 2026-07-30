import { useSelectionStore, useIsSelecting, useIsSelected } from '../../../store/useSelectionStore'
import { timeAgo } from '../../../utils/timeAgo'
import { Icon } from '../../../icons/Icon'
import { Checkbox } from '../../atoms/Checkbox'
import { InlineEditInput } from '../../molecules/InlineEditInput'
import type { Canvas } from '../../../types'

interface Props {
  canvas: Canvas
  isActive: boolean
  isRenaming: boolean
  renameVal: string
  onRenameChange: (v: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onOpen: () => void
  onStartRename: () => void
  onDelete: (e: React.MouseEvent) => void
}

/**
 * One row in the canvas sidebar. Split out of CanvasSidebar so each row can
 * subscribe to its own selection state — hooks can't run inside a list callback.
 */
export function CanvasSidebarRow({
  canvas, isActive, isRenaming, renameVal,
  onRenameChange, onRenameCommit, onRenameCancel,
  onOpen, onStartRename, onDelete,
}: Props): JSX.Element {
  const isSelecting = useIsSelecting('canvas')
  const isSelected  = useIsSelected('canvas', canvas.id)
  const toggle      = useSelectionStore(s => s.toggle)

  return (
    <div
      role="button"
      tabIndex={0}
      data-selected={isSelecting && isSelected ? 'true' : undefined}
      onClick={e => (isSelecting ? toggle(canvas.id, e.shiftKey) : onOpen())}
      onKeyDown={e => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        if (isSelecting) toggle(canvas.id, e.shiftKey)
        else onOpen()
      }}
      className={`group relative flex cursor-pointer items-center gap-2 px-3 py-2 transition ${
        isSelected
          ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--text))]'
          : isActive
            ? 'bg-[rgb(var(--accent))]/10 text-[rgb(var(--text))]'
            : 'text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-3))] hover:text-[rgb(var(--text))]'
      }`}
    >
      {isActive && !isSelecting && (
        <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-[rgb(var(--accent))]" />
      )}

      {isSelecting ? (
        <Checkbox
          checked={isSelected}
          label={`Select "${canvas.title}"`}
          onChange={e => { e.stopPropagation(); toggle(canvas.id, e.shiftKey) }}
        />
      ) : (
        <Icon
          name="layout-dashboard"
          size={13}
          className={`shrink-0 ${isActive ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-3))]'}`}
        />
      )}

      <div className="min-w-0 flex-1">
        {isRenaming ? (
          <InlineEditInput
            value={renameVal}
            onChange={onRenameChange}
            onCommit={onRenameCommit}
            onCancel={onRenameCancel}
            className="w-full px-1"
          />
        ) : (
          <p className="truncate text-[12px] font-medium leading-tight">{canvas.title}</p>
        )}
        <p className="text-[10px] text-[rgb(var(--text-3))]">{timeAgo(canvas.updatedAt)}</p>
      </div>

      {/* Hover actions — the row click means "select" while selecting */}
      {!isSelecting && (
        <div className="absolute right-2 top-0 flex h-full items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            title="Rename"
            onClick={e => { e.stopPropagation(); onStartRename() }}
            className="flex h-5 w-5 items-center justify-center rounded text-[rgb(var(--text-3))] transition hover:text-[rgb(var(--text))]"
          >
            <Icon name="pencil" size={11} />
          </button>
          <button
            type="button"
            title="Delete"
            onClick={onDelete}
            className="flex h-5 w-5 items-center justify-center rounded text-[rgb(var(--text-3))] transition hover:text-red-400"
          >
            <Icon name="trash-2" size={11} />
          </button>
        </div>
      )}
    </div>
  )
}
