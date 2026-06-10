import { useRef } from 'react'
import type { PenStroke } from '../../../types'
import { usePenCanvasEngine } from './usePenCanvasEngine'
import { PenCanvasToolbar } from './PenCanvasToolbar'

interface PenCanvasProps {
  strokes: PenStroke[]
  onChange: (strokes: PenStroke[]) => void
  pageWidth: number
  height: number
  onGrow: (height: number) => void
  /** Receives the lasso-selected strokes when the user taps "To text". */
  onSelectionToText?: (selected: PenStroke[]) => void
  toTextAvailable?: boolean
}

/**
 * A dedicated full-page handwriting surface (Samsung-Notes-like): one tall
 * paper page that grows as you write, with a minimal pen/highlighter/eraser/
 * lasso toolbar. Not an overlay on the text editor.
 */
export function PenCanvas({ strokes, onChange, pageWidth, height, onGrow, onSelectionToText, toTextAvailable }: PenCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engine = usePenCanvasEngine({ canvasRef, strokes, onChange, pageWidth, height, onGrow })

  const handleToText = onSelectionToText
    ? () => {
        const selected = strokes.filter(s => engine.selectedIds.has(s.id))
        if (selected.length) onSelectionToText(selected)
      }
    : undefined

  // Stylus always draws; finger scrolls unless "finger draws" is on.
  const touchAction = engine.allowFinger ? 'none' : 'pan-y'
  const cursor = engine.tool === 'eraser' || engine.tool === 'lasso' ? 'crosshair' : 'default'

  return (
    <div className="flex h-full flex-col">
      <PenCanvasToolbar engine={engine} onSelectionToText={handleToText} toTextAvailable={toTextAvailable} />

      {/* Distinct "paper": theme surface + border/shadow so the writing area
          stands apart from the app background (still theme-aware, not white). */}
      <div className="min-h-0 flex-1 overflow-auto bg-[rgb(var(--bg))] p-4">
        <div
          className="mx-auto overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-md"
          style={{ width: pageWidth, maxWidth: '100%' }}
        >
          {/* canvas inherits `color` from the theme so AUTO_INK strokes stay visible */}
          <canvas ref={canvasRef} className="block text-[rgb(var(--text))]" style={{ touchAction, cursor }} />
        </div>
      </div>
    </div>
  )
}
