import { useEffect, useRef, useState } from 'react'

import { THEME_REGISTRY } from '../../themes/registry'
import type { ThemeMode } from '../../types'
import { Icon } from '../../icons/Icon'

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

  const current = THEME_REGISTRY.find(t => t.id === value) ?? THEME_REGISTRY[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="btn btn-primary btn-sm inline-flex items-center gap-1.5 min-w-[120px]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ThemeSwatch bg={current.swatchBg} accent={current.swatchAccent} />
        {current.label}
        <Icon name="chevron-down" size={12} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-soft"
        >
          {THEME_REGISTRY.map(theme => (
            <button
              key={theme.id}
              role="option"
              aria-selected={theme.id === value}
              onClick={() => { onChange(theme.id); setOpen(false) }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition ${
                theme.id === value
                  ? 'bg-accent text-accent-fg font-semibold'
                  : 'text-text hover:bg-surface3'
              }`}
            >
              <ThemeSwatch bg={theme.swatchBg} accent={theme.swatchAccent} />
              {theme.label}
              {theme.id === value && <span className="ml-auto text-[10px] opacity-60">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ThemeSwatch({ bg, accent }: { bg: string; accent: string }) {
  return (
    <span
      className="relative inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
      style={{ background: bg }}
    >
      <span
        className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white/20"
        style={{ background: accent }}
      />
    </span>
  )
}
