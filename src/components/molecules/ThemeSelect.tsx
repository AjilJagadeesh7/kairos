import { useEffect, useRef, useState } from 'react'

import { THEME_REGISTRY } from '../../themes/registry'
import { ThemeOptionList, ThemeSwatch } from './ThemeOptionList'
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', handler)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = THEME_REGISTRY.find(t => t.id === value) ?? THEME_REGISTRY[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="btn btn-primary btn-sm inline-flex items-center gap-1.5 min-w-[150px]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ThemeSwatch bg={current.swatchBg} accent={current.swatchAccent} />
        {current.label}
        {/* Both variants share a label, so name the one that's active. */}
        <span className="opacity-60">· {current.isDark ? 'Dark' : 'Light'}</span>
        <Icon name="chevron-down" size={12} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Theme"
          className="absolute right-0 top-full z-50 mt-1 w-[22rem] rounded-lg border border-border bg-surface p-1.5 shadow-xl"
        >
          <ThemeOptionList
            value={value}
            onSelect={t => { onChange(t); setOpen(false) }}
          />
        </div>
      )}
    </div>
  )
}
