import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { RefObject } from 'react'

/**
 * Pinch-to-zoom for the editor surface: a two-finger gesture scales the content
 * via the persisted `editorZoom` setting. Returns the current zoom so the caller
 * can hand it to CSS.
 */
export function useEditorPinchZoom(rootRef: RefObject<HTMLDivElement | null>): number {
  const editorZoom    = useAppStore(s => s.editorZoom)
  const setEditorZoom = useAppStore(s => s.setEditorZoom)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let startDist = 0
    let startZoom = 1
    const distance = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = distance(e.touches)
        startZoom = useAppStore.getState().editorZoom
      }
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault()
        setEditorZoom(startZoom * (distance(e.touches) / startDist))
      }
    }
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) startDist = 0 }
    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: false })
    root.addEventListener('touchend', onEnd)
    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
      root.removeEventListener('touchend', onEnd)
    }
  }, [rootRef, setEditorZoom])

  return editorZoom
}
