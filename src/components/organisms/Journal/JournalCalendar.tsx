import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useJournalStore, todayDate } from '../../../store/useJournalStore'

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
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
  const [viewMonth, setViewMonth] = useState(initM - 1)   // 0-indexed

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

  // Build calendar grid (Monday-first)
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()   // 0=Sun…6=Sat
  const leadingBlanks = (firstDow + 6) % 7   // shift so Monday=0
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

      {/* Calendar */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Month nav */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
            aria-label="Previous month"
          >
            <ChevronLeft size={15} />
          </button>

          <span className="text-sm font-medium text-[rgb(var(--text))]">
            {MONTHS[viewMonth]} {viewYear}
          </span>

          <button
            onClick={nextMonth}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
            aria-label="Next month"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Day-of-week labels */}
        <div className="mb-1 grid grid-cols-7 gap-0.5">
          {DAYS.map(d => (
            <div key={d} className="py-0.5 text-center text-[10px] font-medium text-[rgb(var(--text-3))]">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
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
                    ? 'bg-[rgb(var(--accent))] text-white'
                    : isToday
                      ? 'bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))] font-bold'
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

        {/* Today button */}
        {!isCurrentMonth && (
          <button
            onClick={goToday}
            className="mt-4 w-full rounded-md border border-[rgb(var(--border))] py-1.5 text-xs font-medium text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent)/0.5)] hover:text-[rgb(var(--accent))]"
          >
            Today
          </button>
        )}
      </div>

      {/* Entry count */}
      <div className="border-t border-[rgb(var(--border))] px-4 py-2.5">
        <p className="text-[11px] text-[rgb(var(--text-3))]">
          {Object.keys(entries).length} entries
        </p>
      </div>
    </aside>
  )
}
