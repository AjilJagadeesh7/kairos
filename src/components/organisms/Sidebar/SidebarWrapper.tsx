import { useRef } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { useSidebarResize } from '../../../hooks/useSidebarResize'

interface SidebarWrapperProps {
  children: React.ReactNode
  className?: string
}

export function SidebarWrapper({ children, className = '' }: SidebarWrapperProps) {
  const sidebarOpen  = useAppStore(s => s.sidebarOpen)
  const sidebarWidth = useAppStore(s => s.sidebarWidth)
  const containerRef = useRef<HTMLDivElement>(null)
  const { startResize } = useSidebarResize(containerRef)

  return (
    <div
      ref={containerRef}
      className={`relative shrink-0 overflow-hidden border-r border-border ${className}`}
      style={{
        width:      sidebarOpen ? sidebarWidth : 0,
        // Only animate the open/close toggle — resize disables this dynamically
        transition: 'width 150ms ease',
      }}
    >
      {/* Fixed-width inner so content doesn't squash during open/close animation */}
      <div className="absolute inset-0" style={{ width: sidebarWidth }}>
        {children}
      </div>

      {/* Drag handle — right edge */}
      <div
        aria-hidden
        className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize opacity-0 transition-opacity hover:opacity-100 hover:bg-accent/40 active:opacity-100 active:bg-accent/60"
        onMouseDown={startResize}
      />
    </div>
  )
}
