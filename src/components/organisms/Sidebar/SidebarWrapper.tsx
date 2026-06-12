import { useEffect, useRef } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { useSidebarResize } from '../../../hooks/useSidebarResize'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { registerBackHandler } from '../../../utils/backHandler'

interface SidebarWrapperProps {
  children: React.ReactNode
  className?: string
}

export function SidebarWrapper({ children, className = '' }: SidebarWrapperProps) {
  const sidebarOpen   = useAppStore(s => s.sidebarOpen)
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen)
  const sidebarWidth  = useAppStore(s => s.sidebarWidth)
  const containerRef  = useRef<HTMLDivElement>(null)
  const { startResize } = useSidebarResize(containerRef)
  const isMobile = useIsMobile()

  // Android back closes the mobile drawer before navigating.
  useEffect(() => {
    if (!isMobile || !sidebarOpen) return
    return registerBackHandler(() => setSidebarOpen(false))
  }, [isMobile, sidebarOpen, setSidebarOpen])

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}
        {/* Slide-in drawer */}
        <div
          className="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-surface2 transition-transform duration-200"
          style={{
            width: Math.min(sidebarWidth, window.innerWidth * 0.85),
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          {children}
        </div>
      </>
    )
  }

  // Clamp so a wide saved width can't swallow a portrait tablet (no-op on
  // large desktop screens where 40vw exceeds the resize limit anyway).
  const clampedWidth = `min(${sidebarWidth}px, 40vw)`

  return (
    <div
      ref={containerRef}
      className={`relative shrink-0 overflow-hidden border-r border-border ${className}`}
      style={{
        width:      sidebarOpen ? clampedWidth : 0,
        transition: 'width 150ms ease',
      }}
    >
      {/* Fixed-width inner so content doesn't squash during open/close animation */}
      <div className="absolute inset-0" style={{ width: clampedWidth }}>
        {children}
      </div>

      {/* Drag handle — right edge (pointer events so touch can resize too) */}
      <div
        aria-hidden
        className="pane-resize-handle absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize touch-none opacity-0 transition-opacity hover:opacity-100 hover:bg-accent/40 active:opacity-100 active:bg-accent/60"
        onPointerDown={startResize}
      />
    </div>
  )
}
