import { Icon } from '../../../icons/Icon'

interface GraphViewToolbarProps {
  focusMode: boolean
  selectedNoteId: string | null
  use3D: boolean
  onToggleFocus: () => void
  onRelayout: () => void
  onToggle3D: () => void
}

export function GraphViewToolbar({
  focusMode, selectedNoteId, use3D, onToggleFocus, onRelayout, onToggle3D,
}: GraphViewToolbarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-end gap-1 px-3 py-2"
      style={{ borderBottom: '1px solid rgb(var(--border))', background: 'rgb(var(--surface-2))' }}
    >
      <button
        title={focusMode ? 'Exit focus mode' : 'Focus on selected node'}
        onClick={onToggleFocus}
        disabled={!selectedNoteId}
        className={`rounded-md p-1.5 transition ${
          focusMode
            ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]'
            : 'text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-3))] hover:text-[rgb(var(--text))] disabled:opacity-30'
        }`}
      >
        <Icon name="crosshair" size={13} />
      </button>
      <button
        title="Re-layout"
        onClick={onRelayout}
        className="rounded-md p-1.5 text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-3))] hover:text-[rgb(var(--text))]"
      >
        <Icon name="refresh-cw" size={13} />
      </button>
      <button
        title={use3D ? 'Switch to 2D canvas' : 'Switch to 3D WebGL (faster for large graphs)'}
        onClick={onToggle3D}
        className={`rounded-md p-1.5 transition text-xs font-semibold ${
          use3D
            ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]'
            : 'text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-3))] hover:text-[rgb(var(--text))]'
        }`}
      >
        {use3D ? '2D' : '3D'}
      </button>
    </div>
  )
}
