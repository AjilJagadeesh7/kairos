import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Monitor, Moon, Zap } from 'lucide-react'
import type { ThemeMode } from '../../types'

const THEMES: { value: ThemeMode; label: string; icon: typeof Monitor }[] = [
  { value: 'light',     label: 'Light',     icon: Monitor },
  { value: 'dark',      label: 'Dark',      icon: Moon },
  { value: 'cyberpunk', label: 'Cyberpunk', icon: Zap },
]

interface ThemeSelectProps {
  value: ThemeMode
  onChange: (t: ThemeMode) => void
}

export function ThemeSelect({ value, onChange }: ThemeSelectProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  const current = THEMES.find((t) => t.value === value)!
  const Icon = current.icon

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn btn-primary btn-sm inline-flex w-[112px] items-center gap-1.5"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icon size={13} />
        {current.label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 min-w-[130px] overflow-hidden rounded-md border border-border bg-surface py-1 shadow-soft"
        >
          {THEMES.map(({ value: tv, label, icon: TIcon }) => (
            <button
              key={tv}
              role="option"
              aria-selected={tv === value}
              onClick={() => { onChange(tv); setOpen(false) }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition
                ${tv === value
                  ? 'bg-accent text-accent-fg font-semibold'
                  : 'text-text hover:bg-surface3'
                }`}
            >
              <TIcon size={13} />
              {label}
              {tv === value && <span className="ml-auto text-[10px] opacity-60">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
