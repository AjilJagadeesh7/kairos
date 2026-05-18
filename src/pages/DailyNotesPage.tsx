import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useDailyNotesStore, todayDate } from '../store/useDailyNotesStore'
import { DailyCalendar } from '../components/organisms/DailyNotes/DailyCalendar'
import { DailyNoteEditor } from '../components/organisms/DailyNotes/DailyNoteEditor'

export function DailyNotesPage() {
  const { date }              = useParams<{ date?: string }>()
  const navigate              = useNavigate()
  const isLoaded              = useDailyNotesStore(s => s.isLoaded)
  const loadDailyNotes        = useDailyNotesStore(s => s.loadDailyNotes)
  const setActiveDailyDate    = useDailyNotesStore(s => s.setActiveDailyDate)
  const mobileSidebarOpen     = useAppStore(s => s.mobileSidebarOpen)
  const setMobileSidebarOpen  = useAppStore(s => s.setMobileSidebarOpen)

  useEffect(() => {
    if (!isLoaded) void loadDailyNotes()
  }, [isLoaded, loadDailyNotes])

  useEffect(() => {
    setActiveDailyDate(date ?? null)
  }, [date, setActiveDailyDate])

  // Default to today when landing on /daily with no date
  useEffect(() => {
    if (!date) navigate(`/daily/${todayDate()}`, { replace: true })
  }, [date, navigate])

  if (!isLoaded) {
    return (
      <main className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[rgb(var(--text-3))]" />
      </main>
    )
  }

  return (
    <main className="relative flex h-full overflow-hidden">
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 xl:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Calendar sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 transition-transform duration-300 ease-in-out xl:relative xl:inset-auto xl:z-auto xl:w-[260px] xl:translate-x-0 xl:flex-shrink-0 ${
          mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <DailyCalendar activeDate={date ?? todayDate()} onClose={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Editor area */}
      <section className="flex min-w-0 flex-1 flex-col border-l border-[rgb(var(--border))]">
        {date ? (
          <DailyNoteEditor date={date} />
        ) : (
          <div className="flex h-full items-center justify-center text-[rgb(var(--text-2))] text-sm">
            Select a date to start writing.
          </div>
        )}
      </section>
    </main>
  )
}
