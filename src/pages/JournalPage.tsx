import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useJournalStore, todayDate } from '../store/useJournalStore'
import { JournalCalendar } from '../components/organisms/Journal/JournalCalendar'
import { JournalEditor } from '../components/organisms/Journal/JournalEditor'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { VaultBanner } from '../components/common/VaultBanner'

export function JournalPage() {
  const { date }             = useParams<{ date?: string }>()
  const navigate             = useNavigate()
  const isLoaded             = useJournalStore(s => s.isLoaded)
  const loadEntries          = useJournalStore(s => s.loadEntries)
  const setActiveDate        = useJournalStore(s => s.setActiveDate)
  const mobileSidebarOpen    = useAppStore(s => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore(s => s.setMobileSidebarOpen)

  useEffect(() => {
    if (!isLoaded) void loadEntries()
  }, [isLoaded, loadEntries])

  useEffect(() => {
    setActiveDate(date ?? null)
  }, [date, setActiveDate])

  useEffect(() => {
    if (!date) navigate(`/journal/${todayDate()}`, { replace: true })
  }, [date, navigate])

  if (!isLoaded) {
    return (
      <main className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[rgb(var(--text-3))]" />
      </main>
    )
  }

  return (
    <main className="relative flex h-full flex-col overflow-hidden">
      <VaultBanner />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 xl:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-30 w-72 transition-transform duration-300 ease-in-out xl:relative xl:inset-auto xl:z-auto xl:w-[260px] xl:translate-x-0 xl:flex-shrink-0 ${
            mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          <JournalCalendar activeDate={date ?? todayDate()} onClose={() => setMobileSidebarOpen(false)} />
        </div>

        <section className="flex min-w-0 flex-1 flex-col border-l border-[rgb(var(--border))]">
          <ErrorBoundary resetKeys={[date]}>
            {date ? (
              <JournalEditor date={date} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[rgb(var(--text-2))]">
                Select a date to start writing.
              </div>
            )}
          </ErrorBoundary>
        </section>
      </div>
    </main>
  )
}
