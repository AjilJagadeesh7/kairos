import { useEffect, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../../../store/useCanvasStore'
import { Icon } from '../../../icons/Icon'
import { SlotRenderer } from '../../molecules/SlotRenderer'
import type { Canvas } from '../../../types'

function CanvasTitleEditor({ canvas }: { canvas: Canvas }) {
  const updateCanvasTitle = useCanvasStore(s => s.updateCanvasTitle)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(canvas.title)
  useEffect(() => { setDraft(canvas.title) }, [canvas.title])

  function commit() {
    const title = draft.trim() || 'Untitled canvas'
    if (title !== canvas.title) updateCanvasTitle(canvas.id, title)
    setEditing(false)
  }

  if (editing) {
    return (
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(canvas.title); setEditing(false) } }}
        className="rounded border border-[rgb(var(--accent))] bg-[rgb(var(--surface))] px-2 py-0.5 text-[14px] font-semibold text-[rgb(var(--text))] outline-none"
        style={{ minWidth: 120, maxWidth: 280 }} />
    )
  }
  return (
    <button type="button" onClick={() => setEditing(true)} title="Click to rename"
      className="max-w-[110px] truncate rounded px-2 py-0.5 text-[14px] font-semibold text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))] md:max-w-[200px]">
      {canvas.title}
    </button>
  )
}

function ToolBtn({ label, icon, onClick, active, disabled }: {
  label: string; icon: Parameters<typeof Icon>[0]['name']
  onClick: () => void; active?: boolean; disabled?: boolean
}) {
  return (
    <button type="button" title={label} onClick={onClick} disabled={disabled}
      className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium transition disabled:opacity-30 ${
        active ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
               : 'text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]'
      }`}>
      <Icon name={icon} size={13} />
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}

function IconBtn({ label, icon, onClick, active, disabled }: {
  label: string; icon: Parameters<typeof Icon>[0]['name']
  onClick: () => void; active?: boolean; disabled?: boolean
}) {
  return (
    <button type="button" title={label} onClick={onClick} disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition disabled:opacity-30 ${
        active ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
               : 'text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]'
      }`}>
      <Icon name={icon} size={13} />
    </button>
  )
}

const SEP = <div className="mx-1 h-4 w-px bg-[rgb(var(--border))]" />

interface CanvasToolbarProps {
  canvas: Canvas
  onAddText: () => void
  onAddNote: () => void
  onAddAttachment: () => void
  showMinimap: boolean
  onToggleMinimap: () => void
  selectMode: boolean
  onToggleSelectMode: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

export function CanvasToolbar({
  canvas, onAddText, onAddNote, onAddAttachment,
  showMinimap, onToggleMinimap,
  selectMode, onToggleSelectMode,
  canUndo, canRedo, onUndo, onRedo,
}: CanvasToolbarProps) {
  const { fitView } = useReactFlow()
  const setCanvasNoSync = useCanvasStore(s => s.setCanvasNoSync)

  return (
    <div className="touch-compact flex shrink-0 items-center gap-0.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 py-1.5 shadow-lg">
      <CanvasTitleEditor canvas={canvas} />
      {SEP}
      <IconBtn label="Undo (Ctrl+Z)"  icon="undo-2" onClick={onUndo} disabled={!canUndo} />
      <IconBtn label="Redo (Ctrl+Y)"  icon="redo-2" onClick={onRedo} disabled={!canRedo} />
      {SEP}
      <IconBtn label={selectMode ? 'Pan mode' : 'Select mode — drag to rubber-band'} icon="mouse-pointer-2" onClick={onToggleSelectMode} active={selectMode} />
      {SEP}
      <ToolBtn label="Text"       icon="sticky-note" onClick={onAddText} />
      <ToolBtn label="Note"       icon="file-text"   onClick={onAddNote} />
      <ToolBtn label="Attachment" icon="paperclip"   onClick={onAddAttachment} />
      {SEP}
      <IconBtn label="Fit view"   icon="crosshair" onClick={() => fitView({ padding: 0.12, duration: 300 })} />
      <IconBtn label={showMinimap ? 'Hide minimap' : 'Minimap'} icon="layers" onClick={onToggleMinimap} active={showMinimap} />
      {SEP}
      <IconBtn
        label={canvas.noSync ? 'Local only — click to sync this canvas' : "Don't sync this canvas"}
        icon={canvas.noSync ? 'cloud-off' : 'cloud'}
        onClick={() => setCanvasNoSync(canvas.id, !canvas.noSync)}
        active={canvas.noSync}
      />
      <SlotRenderer slot="canvas:toolbar:end" props={{ canvasId: canvas.id }} className="flex items-center" />
    </div>
  )
}
