import { useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

/** Ref placed on the sidebar outer div — we toggle a data-resizing attr to kill CSS transitions during drag. */
export function useSidebarResize(containerRef?: React.RefObject<HTMLDivElement>) {
  const sidebarWidth    = useAppStore(s => s.sidebarWidth)
  const setSidebarWidth = useAppStore(s => s.setSidebarWidth)

  // Pointer events (not mouse events) so touch/pen can resize on tablets.
  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX     = e.clientX
    const startWidth = sidebarWidth
    const el         = containerRef?.current

    // Kill the CSS transition so the div tracks the pointer 1:1
    if (el) el.style.transition = 'none'

    function onMove(ev: PointerEvent) {
      setSidebarWidth(startWidth + ev.clientX - startX)
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
      // Restore transition for open/close toggle
      if (el) el.style.transition = ''
    }

    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
  }, [sidebarWidth, setSidebarWidth, containerRef])

  return { startResize }
}
