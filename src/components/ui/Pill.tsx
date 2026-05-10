import type { ReactNode } from 'react'
import { Button } from './Button'

interface PillProps {
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  className?: string
}

export function Pill({ children, selected = false, onClick, className = '' }: PillProps): JSX.Element {
  return (
    <Button
      variant="pill"
      size="xs"
      onClick={onClick}
      className={selected ? 'active' : className}
      aria-selected={selected}
    >
      {children}
    </Button>
  )
}