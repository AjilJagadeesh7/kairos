import { Check } from 'lucide-react'
import { TAG_COLOR_PALETTE } from '../../utils/kanban'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  palette?: string[]
  className?: string
  cols?: number
}

export function ColorPicker({ value, onChange, palette = TAG_COLOR_PALETTE, className = '', cols = 8 }: ColorPickerProps): JSX.Element {
  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {palette.map(color => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="relative flex h-6 w-6 items-center justify-center rounded-md transition-all hover:scale-110 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-1"
          style={{ backgroundColor: color }}
          aria-label={`Select color ${color}`}
          aria-pressed={value === color}
        >
          {value === color && <Check size={11} color="white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  )
}
