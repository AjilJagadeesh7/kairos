interface DividerProps {
  className?: string
}

export function Divider({ className = '' }: DividerProps): JSX.Element {
  return <div role="separator" className={`border-t border-border ${className}`} />
}
