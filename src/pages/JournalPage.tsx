import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { useAppStore } from '../store/useAppStore'
import { useJournalStore, todayDate } from '../store/useJournalStore'
import { usePaneStore } from '../store/usePaneStore'
import { usePaneId, useSidebarSlot } from '../contexts/PaneContext'
import { SidebarWrapper } from '../components/organisms/Sidebar/SidebarWrapper'
import { eventMatchesAction } from '../hooks/useShortcutKey'
import { JournalCalendar } from '../components/organisms/Journal/JournalCalendar'
import { JournalEditor } from '../components/organisms/Journal/JournalEditor'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { VaultBanner } from '../components/common/VaultBanner'
import { Icon } from '../icons/Icon'

export function JournalPage() {
  const { date }             = useParams<{ date?: string }>()
  const navigate             = useNavigate()
  const isLoaded             = useJournalStore(s => s.isLoaded)
  const loadEntries          = useJournalStore(s => s.loadEntries)
  const setActiveDate        = useJournalStore(s => s.setActiveDate)
  const keyBindings          = useAppStore(s => s.keyBindings)
  const paneId               = usePaneId()
  const focusedPaneId        = usePaneStore(s => s.focusedPaneId)
  const isMultiPane          = usePaneStore(s => s.panes.length > 1)
  const isFocused            = paneId === focusedPaneId
  const slot                 = useSidebarSlot()

  useEffect(() => {
    if (!isLoaded) void loadEntries()
  }, [isLoaded, loadEntries])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (eventMatchesAction(e, 'journal-today', keyBindings)) {
        e.preventDefault()
        navigate(`/journal/${todayDate()}`)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, keyBindings])

  useEffect(() => { setActiveDate(date ?? null) }, [date, setActiveDate])

  useEffect(() => {
    if (!date) navigate(`/journal/${todayDate()}`, { replace: true })
  }, [date, navigate])

  if (!isLoaded) {
    return (
      <main className="flex h-full items-center justify-center">
        <Icon name="loader-2" size={24} className="animate-spin text-[rgb(var(--text-3))]" />
      </main>
    )
  }

  const calendar = <JournalCalendar activeDate={date ?? todayDate()} />

  return (
    <main className="relative flex h-full flex-col overflow-hidden">
      <VaultBanner />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">

        {isMultiPane
          ? isFocused && slot ? createPortal(calendar, slot) : null
          : <SidebarWrapper>{calendar}</SidebarWrapper>
        }

        <section className="flex min-w-0 flex-1 flex-col">
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
