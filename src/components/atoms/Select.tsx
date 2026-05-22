import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../icons/Icon'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
}

interface SelectProps<T extends string = string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  className?: string
}

export function Select<T extends string = string>({ value, options, onChange, className = '' }: SelectProps<T>): JSX.Element {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, minWidth: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (!buttonRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [open])

  function handleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: rect.width,
      })
    }
    setOpen(o => !o)
  }

  const current = options.find(o => o.value === value)

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2 py-1 text-[11px] font-medium text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--text))]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current?.label ?? value}
        <Icon name="chevron-down" size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: Math.max(pos.minWidth, 120),
            zIndex: 99999,
          }}
          className="overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-1 shadow-lg"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-[11px] transition ${
                opt.value === value
                  ? 'bg-[rgb(var(--accent))]/10 font-semibold text-[rgb(var(--accent))]'
                  : 'text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]'
              }`}
            >
              {opt.label}
              {opt.value === value && <span className="ml-auto opacity-60">✓</span>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
