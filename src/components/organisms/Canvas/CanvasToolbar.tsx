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
      className="max-w-[260px] truncate rounded px-2 py-0.5 text-[14px] font-semibold text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))]">
      {canvas.title}
    </button>
  )
}

function ToolBtn({ label, icon, onClick, active }: {
  label: string; icon: Parameters<typeof Icon>[0]['name']; onClick: () => void; active?: boolean
}) {
  return (
    <button type="button" title={label} onClick={onClick}
      className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium transition ${
        active ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
               : 'text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]'
      }`}>
      <Icon name={icon} size={13} />
      <span>{label}</span>
    </button>
  )
}

interface CanvasToolbarProps {
  canvas: Canvas
  onAddText: () => void
  onAddNote: () => void
  onAddWeb: () => void
  showMinimap: boolean
  onToggleMinimap: () => void
}

export function CanvasToolbar({ canvas, onAddText, onAddNote, onAddWeb, showMinimap, onToggleMinimap }: CanvasToolbarProps) {
  const { fitView } = useReactFlow()

  return (
    <div className="flex items-center gap-1 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 py-1.5 shadow-lg">
      <CanvasTitleEditor canvas={canvas} />
      <div className="mx-1.5 h-4 w-px bg-[rgb(var(--border))]" />
      <ToolBtn label="Text card"  icon="sticky-note" onClick={onAddText} />
      <ToolBtn label="Note"       icon="file-text"   onClick={onAddNote} />
      <ToolBtn label="Web page"   icon="globe"        onClick={onAddWeb} />
      <div className="mx-1.5 h-4 w-px bg-[rgb(var(--border))]" />
      <ToolBtn label="Fit view"   icon="crosshair"   onClick={() => fitView({ padding: 0.12, duration: 300 })} />
      <ToolBtn label={showMinimap ? 'Hide minimap' : 'Minimap'} icon="layers" onClick={onToggleMinimap} active={showMinimap} />
      <SlotRenderer slot="canvas:toolbar:end" props={{ canvasId: canvas.id }} className="flex items-center" />
    </div>
  )
}
