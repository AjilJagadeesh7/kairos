import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../../../icons/Icon'

interface Props {
  value: string | undefined
  onChange: (iso: string | undefined) => void
  /** Placeholder shown when no date is set. */
  label?: string
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function parseLocalDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function DueDatePicker({ value, onChange, label: placeholder = 'Due date' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const today    = new Date()
  const selected = value ? parseLocalDate(value) : null

  const [viewYear,  setViewYear]  = useState(selected?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth()    ?? today.getMonth())

  // Sync view to selection when value changes externally
  useEffect(() => {
    if (selected) { setViewYear(selected.getFullYear()); setViewMonth(selected.getMonth()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    onChange(iso)
    setOpen(false)
  }

  function clearDate(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(undefined)
    setOpen(false)
  }

  const label = selected
    ? selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 rounded-lg border bg-[rgb(var(--surface-2))] px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent))] ${
          open ? 'border-[rgb(var(--accent))]' : 'border-[rgb(var(--border))]'
        }`}
      >
        <Icon name="calendar" size={11} />
        {label}
        {selected && (
          <span
            role="button"
            onClick={clearDate}
            className="ml-0.5 flex items-center opacity-50 hover:opacity-100"
          >
            <Icon name="x" size={10} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-56 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 shadow-xl">
          {/* Month nav */}
          <div className="mb-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]"
            >
              <Icon name="chevron-left" size={14} />
            </button>
            <span className="text-xs font-semibold text-[rgb(var(--text))]">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]"
            >
              <Icon name="chevron-right" size={14} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {DAY_LABELS.map(d => (
              <span key={d} className="text-[10px] font-medium text-[rgb(var(--text-3))]">{d}</span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <span key={`pad-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day     = i + 1
              const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
              const isSel   = !!selected && day === selected.getDate() && viewMonth === selected.getMonth() && viewYear === selected.getFullYear()
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`flex h-7 w-full items-center justify-center rounded-md text-xs transition ${
                    isSel
                      ? 'bg-[rgb(var(--accent))] font-semibold text-white'
                      : isToday
                        ? 'font-semibold text-[rgb(var(--accent))] hover:bg-[rgb(var(--surface-2))]'
                        : 'text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Today shortcut + clear */}
          <div className="mt-2.5 flex items-center gap-2 border-t border-[rgb(var(--border))] pt-2">
            <button
              type="button"
              onClick={() => {
                const d = today
                const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
                onChange(iso); setOpen(false)
              }}
              className="flex-1 rounded-md py-1 text-[11px] text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
            >
              Today
            </button>
            {selected && (
              <button
                type="button"
                onClick={clearDate}
                className="flex-1 rounded-md py-1 text-[11px] text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
