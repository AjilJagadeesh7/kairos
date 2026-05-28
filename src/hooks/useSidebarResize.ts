import { useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

/** Ref placed on the sidebar outer div — we toggle a data-resizing attr to kill CSS transitions during drag. */
export function useSidebarResize(containerRef?: React.RefObject<HTMLDivElement>) {
  const sidebarWidth    = useAppStore(s => s.sidebarWidth)
  const setSidebarWidth = useAppStore(s => s.setSidebarWidth)

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX     = e.clientX
    const startWidth = sidebarWidth
    const el         = containerRef?.current

    // Kill the CSS transition so the div tracks the cursor 1:1
    if (el) el.style.transition = 'none'

    function onMove(ev: MouseEvent) {
      setSidebarWidth(startWidth + ev.clientX - startX)
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
      // Restore transition for open/close toggle
      if (el) el.style.transition = ''
    }

    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth, setSidebarWidth, containerRef])

  return { startResize }
}
