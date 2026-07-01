import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useJournalStore, todayDate } from '../../../store/useJournalStore'
import { Button } from '../../atoms/Button'
import { Icon } from '../../../icons/Icon'
import { IconButton } from '../../atoms/IconButton'

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short' })
  return `${dow}, ${d} ${MONTHS_SHORT[m - 1]} ${y}`
}

interface JournalCalendarProps {
  activeDate: string | null
  onClose?: () => void
}

export function JournalCalendar({ activeDate, onClose }: JournalCalendarProps) {
  const today = todayDate()
  const [today_y, today_m] = today.split('-').map(Number)

  const initDate = activeDate ?? today
  const [initY, initM] = initDate.split('-').map(Number)

  const [viewYear, setViewYear]   = useState(initY)
  const [viewMonth, setViewMonth] = useState(initM - 1)
  const [query, setQuery]         = useState('')

  const entries  = useJournalStore(s => s.entries)
  const navigate = useNavigate()

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function goToday() {
    setViewYear(today_y)
    setViewMonth(today_m - 1)
    navigate(`/journal/${today}`)
    onClose?.()
  }

  function selectDay(date: string) {
    navigate(`/journal/${date}`)
    onClose?.()
  }

  // Search results — sorted newest first
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return Object.entries(entries)
      .filter(([date, entry]) =>
        date.includes(q) ||
        entry.content.toLowerCase().includes(q) ||
        formatDateLabel(date).toLowerCase().includes(q)
      )
      .sort(([a], [b]) => b.localeCompare(a))
  }, [query, entries])

  // Build calendar grid (Monday-first)
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const leadingBlanks = (firstDow + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const isCurrentMonth = viewYear === today_y && viewMonth === today_m - 1

  return (
    <aside className="flex h-full flex-col bg-[rgb(var(--surface))]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-4 py-3">
        <span className="text-sm font-semibold text-[rgb(var(--text))]">Journal</span>
      </div>

      {/* Search */}
      <div className="border-b border-[rgb(var(--border))] px-3 py-2">
        <div className="relative">
          <Icon name="search" size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[rgb(var(--text-3))]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search entries…"
            className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] py-1.5 pl-7 pr-7 text-xs text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))] focus:border-[rgb(var(--accent)/0.6)]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]"
            >
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
      </div>

      {query ? (
        /* ── Search results ── */
        <div className="flex-1 overflow-y-auto">
          {searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Icon name="search" size={20} className="text-[rgb(var(--text-3))] opacity-40" />
              <p className="text-xs text-[rgb(var(--text-3))]">No entries match "{query}"</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgb(var(--border))]">
              {searchResults.map(([date, entry]) => {
                const isActive = date === activeDate
                const snippet  = entry.content.replace(/[#*`[\]>]/g, '').trim().slice(0, 100)
                return (
                  <button
                    key={date}
                    onClick={() => selectDay(date)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-[rgb(var(--surface-2))] ${
                      isActive ? 'bg-[rgb(var(--accent)/0.08)]' : ''
                    }`}
                  >
                    <p className={`text-xs font-semibold ${isActive ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text))]'}`}>
                      {formatDateLabel(date)}
                    </p>
                    {snippet && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
                        {snippet}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Calendar ── */
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 flex items-center justify-between">
            <IconButton icon="chevron-left"  label="Previous month" size="sm" onClick={prevMonth} />
            <span className="text-sm font-medium text-[rgb(var(--text))]">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <IconButton icon="chevron-right" label="Next month"     size="sm" onClick={nextMonth} />
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {DAYS.map(d => (
              <div key={d} className="py-0.5 text-center text-[10px] font-medium text-[rgb(var(--text-3))]">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`blank-${idx}`} />
              const date     = toDateString(viewYear, viewMonth, day)
              const isToday  = date === today
              const isActive = date === activeDate
              const hasEntry = Boolean(entries[date])
              return (
                <button
                  key={date}
                  onClick={() => selectDay(date)}
                  className={`relative flex h-8 w-full flex-col items-center justify-center rounded-md text-xs font-medium transition ${
                    isActive
                      ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-fg))]'
                      : isToday
                        ? 'bg-[rgb(var(--accent)/0.15)] font-bold text-[rgb(var(--accent))]'
                        : 'text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]'
                  }`}
                  aria-label={date}
                  aria-pressed={isActive}
                >
                  {day}
                  {hasEntry && (
                    <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${isActive ? 'bg-white/70' : 'bg-[rgb(var(--accent))]'}`} />
                  )}
                </button>
              )
            })}
          </div>

          {!isCurrentMonth && (
            <Button variant="hollow" size="sm" fullWidth className="mt-4" onClick={goToday}>
              Today
            </Button>
          )}
        </div>
      )}

      {/* Entry count */}
      <div className="border-t border-[rgb(var(--border))] px-4 py-2.5">
        <p className="text-[11px] text-[rgb(var(--text-3))]">
          {query
            ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`
            : `${Object.keys(entries).length} entries`}
        </p>
      </div>
    </aside>
  )
}
