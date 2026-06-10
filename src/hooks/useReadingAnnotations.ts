import { useCallback, useEffect, useState } from 'react'
import { useAnnotationStore } from '../store/useAnnotationStore'
import { ANNOTATION_COLORS } from '../types'
import type { Annotation } from '../types'
import { resolveQuote } from '../utils/textQuote'

// The CSS Custom Highlight API paints ranges without mutating the DOM, so it
// coexists with ProseMirror's read-only view. Typed loosely because TS DOM libs
// don't always ship these yet.
type HighlightCtor = new (...ranges: Range[]) => unknown
const HighlightImpl = (globalThis as { Highlight?: HighlightCtor }).Highlight
const highlightRegistry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights
export const supportsHighlightApi = !!HighlightImpl && !!highlightRegistry

function ensureHighlightStyles(): void {
  if (document.getElementById('mv-annot-highlight-styles')) return
  const style = document.createElement('style')
  style.id = 'mv-annot-highlight-styles'
  style.textContent = ANNOTATION_COLORS
    .map((c, i) => `::highlight(mv-hl-${i}){background-color:${c};color:#111827;}`)
    .join('\n')
  document.head.appendChild(style)
}

function colorIndex(color: string): number {
  const i = (ANNOTATION_COLORS as readonly string[]).indexOf(color)
  return i >= 0 ? i : 0
}

export interface AnnotationMarker {
  id: string
  color: string
  comment: string
  left: number
  top: number
}

/**
 * Paints stored highlights over `containerRef` and reports positions for the
 * sticky-note markers (annotations that carry a comment). Repaints on content,
 * scroll, and resize. Returns the live annotations + a manual refresh.
 */
export function useReadingAnnotations(containerRef: React.RefObject<HTMLElement>, docId: string) {
  const annotations = useAnnotationStore(s => s.byDoc[docId]) as Annotation[] | undefined
  const [markers, setMarkers] = useState<AnnotationMarker[]>([])

  const paint = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const anns = annotations ?? []

    if (supportsHighlightApi) {
      ensureHighlightStyles()
      const buckets: Range[][] = ANNOTATION_COLORS.map(() => [])
      for (const a of anns) {
        const range = resolveQuote(container, a)
        if (range) buckets[colorIndex(a.color)].push(range)
      }
      ANNOTATION_COLORS.forEach((_, i) => {
        const name = `mv-hl-${i}`
        if (buckets[i].length) highlightRegistry!.set(name, new HighlightImpl!(...buckets[i]))
        else highlightRegistry!.delete(name)
      })
    }

    // Marker positions (only for annotations with a comment).
    const cRect = container.getBoundingClientRect()
    const next: AnnotationMarker[] = []
    for (const a of anns) {
      if (!a.comment) continue
      const range = resolveQuote(container, a)
      if (!range) continue
      const r = range.getBoundingClientRect()
      next.push({
        id: a.id,
        color: a.color,
        comment: a.comment,
        left: r.right - cRect.left + container.scrollLeft,
        top: r.top - cRect.top + container.scrollTop,
      })
    }
    setMarkers(next)
  }, [containerRef, annotations])

  // Repaint when annotations change (after a short delay so the read-only PM
  // view has finished rendering its content).
  useEffect(() => {
    const t = window.setTimeout(paint, 60)
    return () => window.clearTimeout(t)
  }, [paint])

  // Reposition markers on scroll / resize.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onChange = () => paint()
    container.addEventListener('scroll', onChange, { passive: true })
    window.addEventListener('resize', onChange)
    const ro = new ResizeObserver(onChange)
    ro.observe(container)
    return () => {
      container.removeEventListener('scroll', onChange)
      window.removeEventListener('resize', onChange)
      ro.disconnect()
    }
  }, [containerRef, paint])

  // Clear painted highlights on unmount so they don't bleed into other views.
  useEffect(() => () => {
    if (supportsHighlightApi) ANNOTATION_COLORS.forEach((_, i) => highlightRegistry!.delete(`mv-hl-${i}`))
  }, [])

  return { annotations: annotations ?? [], markers, refresh: paint }
}
