import { Icon } from '../../icons/Icon'

type Size = 'sm' | 'md'

interface CheckboxProps {
  checked: boolean
  /** Shows a dash instead of a tick — some, but not all, of a group is selected. */
  indeterminate?: boolean
  label: string
  size?: Size
  className?: string
  onChange: (e: React.MouseEvent) => void
}

const boxSize:   Record<Size, string> = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4' }
const glyphSize: Record<Size, number> = { sm: 9, md: 11 }

/** Checkbox for multi-select rows and select-all headers. */
export function Checkbox({
  checked,
  indeterminate = false,
  label,
  size = 'sm',
  className = '',
  onChange,
}: CheckboxProps): JSX.Element {
  const filled = checked || indeterminate
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={onChange}
      className={`flex ${boxSize[size]} shrink-0 items-center justify-center rounded-[4px] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
        filled
          ? 'border-accent bg-accent text-white'
          : 'border-border bg-surface hover:border-text3'
      } ${className}`}
    >
      {indeterminate
        ? <span className="h-[1.5px] w-2 rounded-full bg-current" aria-hidden />
        : checked
          ? <Icon name="check" size={glyphSize[size]} aria-hidden />
          : null}
    </button>
  )
}
