import type { ReactNode } from 'react'

interface SectionLabelProps {
  children: ReactNode
  className?: string
}

export function SectionLabel({ children, className = '' }: SectionLabelProps): JSX.Element {
  return (
    <p className={`text-[10px] font-semibold uppercase tracking-widest text-text3 ${className}`}>
      {children}
    </p>
  )
}
