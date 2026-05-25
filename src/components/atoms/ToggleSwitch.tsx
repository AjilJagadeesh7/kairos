type Size = 'sm' | 'md'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  size?: Size
  label?: string
  className?: string
}

const sizeMap: Record<Size, { track: string; thumb: string; thumbOn: string }> = {
  sm: { track: 'h-4 w-8',    thumb: 'h-3 w-3 translate-x-0.5',   thumbOn: 'translate-x-[17px]' },
  md: { track: 'h-5 w-9',    thumb: 'h-3.5 w-3.5 translate-x-[3px]', thumbOn: 'translate-x-[18px]' },
}

export function ToggleSwitch({
  checked,
  onChange,
  size = 'sm',
  label,
  className = '',
}: ToggleSwitchProps): JSX.Element {
  const { track, thumb, thumbOn } = sizeMap[size]
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={e => { e.stopPropagation(); onChange(!checked) }}
      className={`relative inline-flex shrink-0 ${track} items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 ${
        checked ? 'bg-accent' : 'bg-surface3'
      } ${className}`}
    >
      <span className={`inline-block rounded-full bg-white shadow transition-transform ${thumb} ${checked ? thumbOn : ''}`} />
    </button>
  )
}
