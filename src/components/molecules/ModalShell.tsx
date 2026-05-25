import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalShellProps {
  onClose: () => void
  children: ReactNode
  maxWidth?: string
  zIndex?: string
  blur?: boolean
  className?: string
}

export function ModalShell({
  onClose,
  children,
  maxWidth = 'max-w-md',
  zIndex = 'z-50',
  blur = false,
  className = '',
}: ModalShellProps): JSX.Element {
  return createPortal(
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/50 p-4 ${blur ? 'backdrop-blur-sm' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`w-full ${maxWidth} rounded-xl border border-border bg-surface shadow-2xl ${className}`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
