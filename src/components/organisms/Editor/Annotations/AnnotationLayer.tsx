import { useCallback, useEffect, useRef, useState } from 'react'
import { useAnnotationStore } from '../../../../store/useAnnotationStore'
import { ANNOTATION_COLORS } from '../../../../types'
import { getSelectionQuote, type QuoteSelector } from '../../../../utils/textQuote'
import { useReadingAnnotations } from '../../../../hooks/useReadingAnnotations'
import { Icon } from '../../../../icons/Icon'
import { AnnotationCommentPopover } from './AnnotationCommentPopover'

interface SelectionState { x: number; y: number; selector: QuoteSelector }
interface OpenComment { id: string; x: number; y: number }

/**
 * Wraps reading-mode content and provides highlight + sticky-note annotations.
 * Select text → a popover offers highlight colors and "Add note". Existing
 * highlights are painted via the CSS Highlight API; commented ones get a marker.
 */
export function AnnotationLayer({ docId, children }: { docId: string; children: React.ReactNode }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { markers } = useReadingAnnotations(containerRef, docId)
  const add = useAnnotationStore(s => s.add)
  const annotations = useAnnotationStore(s => s.byDoc[docId])

  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [openComment, setOpenComment] = useState<OpenComment | null>(null)

  const detectSelection = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const q = getSelectionQuote(container)
    if (!q) { setSelection(null); return }
    const r = q.range.getBoundingClientRect()
    setSelection({ x: r.left + r.width / 2, y: r.top, selector: { quote: q.quote, prefix: q.prefix, suffix: q.suffix } })
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onUp = () => window.setTimeout(detectSelection, 0)
    container.addEventListener('mouseup', onUp)
    container.addEventListener('touchend', onUp)
    return () => {
      container.removeEventListener('mouseup', onUp)
      container.removeEventListener('touchend', onUp)
    }
  }, [detectSelection])

  const clearSelection = () => { window.getSelection()?.removeAllRanges(); setSelection(null) }

  const highlight = (color: string) => {
    if (!selection) return
    add({ docId, ...selection.selector, color })
    clearSelection()
  }

  const addNote = () => {
    if (!selection) return
    const id = add({ docId, ...selection.selector, color: ANNOTATION_COLORS[0], comment: '' })
    const { x, y } = selection
    clearSelection()
    setOpenComment({ id, x, y: y + 24 })
  }

  const openAnnotation = annotations?.find(a => a.id === openComment?.id)

  return (
    <div ref={containerRef} className="relative">
      {children}

      {/* Sticky-note markers */}
      {markers.map(m => (
        <button
          key={m.id}
          type="button"
          aria-label="View note"
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect()
            setOpenComment({ id: m.id, x: r.left, y: r.bottom + 4 })
          }}
          className="absolute z-10 flex h-5 w-5 -translate-y-1 items-center justify-center rounded-full border border-border bg-bg text-text3 shadow-sm transition hover:text-accent"
          style={{ left: m.left + 2, top: m.top }}
        >
          <Icon name="sticky-note" size={11} />
        </button>
      ))}

      {/* Selection popover */}
      {selection && (
        <div
          className="fixed z-[60] flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-lg border border-border bg-bg p-1 shadow-lg"
          style={{ left: selection.x, top: selection.y - 6 }}
          onMouseDown={e => e.preventDefault() /* keep the text selection alive */}
        >
          {ANNOTATION_COLORS.map(c => (
            <button
              key={c}
              type="button"
              aria-label={`Highlight ${c}`}
              onClick={() => highlight(c)}
              className="h-5 w-5 rounded-full border border-border transition hover:scale-110"
              style={{ backgroundColor: c }}
            />
          ))}
          <span className="mx-0.5 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={addNote}
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-text2 transition hover:bg-surface3 hover:text-text"
          >
            <Icon name="sticky-note" size={12} /> Note
          </button>
        </div>
      )}

      {openComment && openAnnotation && (
        <AnnotationCommentPopover
          annotation={openAnnotation}
          x={openComment.x}
          y={openComment.y}
          onClose={() => setOpenComment(null)}
        />
      )}
    </div>
  )
}
