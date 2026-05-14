interface StatusPillProps {
  connected: boolean
  label?: string
}

export function StatusPill({ connected, label }: StatusPillProps): JSX.Element {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
      connected ? 'bg-green-500/15 text-green-500' : 'bg-[rgb(var(--surface-3))] text-[rgb(var(--text-3))]'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-[rgb(var(--text-3))]'}`} />
      {label ?? (connected ? 'Connected' : 'Not connected')}
    </span>
  )
}
