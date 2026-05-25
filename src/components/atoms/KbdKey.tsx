import type { ReactNode } from 'react'

interface KbdKeyProps {
  children: ReactNode
  className?: string
}

export function KbdKey({ children, className = '' }: KbdKeyProps): JSX.Element {
  return (
    <kbd className={`rounded border border-border bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-text3 ${className}`}>
      {children}
    </kbd>
  )
}
