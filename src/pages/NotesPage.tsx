import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { usePaneStore } from '../store/usePaneStore'
import { usePaneId, useSidebarSlot } from '../contexts/PaneContext'
import { Sidebar } from '../components/organisms/Sidebar/Sidebar'
import { NoteEditor } from '../components/organisms/Editor/NoteEditor'
import { NotesHome } from '../components/organisms/Notes/NotesHome'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { VaultBanner } from '../components/common/VaultBanner'

export function NotesPage() {
  const { noteId }           = useParams<{ noteId: string }>()
  const setActiveNoteId      = useAppStore((s) => s.setActiveNoteId)
  const mobileSidebarOpen    = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)
  const paneId               = usePaneId()
  const focusedPaneId        = usePaneStore(s => s.focusedPaneId)
  const isMultiPane          = usePaneStore(s => s.panes.length > 1)
  const isFocused            = paneId === focusedPaneId
  const slot                 = useSidebarSlot()

  // Only the focused pane updates the global activeNoteId
  useEffect(() => {
    if (!isMultiPane || isFocused) setActiveNoteId(noteId)
  }, [noteId, setActiveNoteId, isMultiPane, isFocused])

  const sidebar = <Sidebar onClose={() => setMobileSidebarOpen(false)} />

  return (
    <main className="relative flex h-full flex-col overflow-hidden">
      <VaultBanner />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">

        {/* Sidebar: portaled into shared slot when multiple panes + focused, inline otherwise */}
        {isMultiPane
          ? isFocused && slot ? createPortal(sidebar, slot) : null
          : (
            <>
              {mobileSidebarOpen && (
                <div
                  className="fixed inset-0 z-20 bg-black/40 xl:hidden"
                  onClick={() => setMobileSidebarOpen(false)}
                />
              )}
              <div
                className={`fixed inset-y-0 left-0 z-30 w-72 transition-transform duration-300 ease-in-out xl:relative xl:inset-auto xl:z-auto xl:w-[280px] xl:translate-x-0 xl:flex-shrink-0 ${
                  mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
                }`}
              >
                {sidebar}
              </div>
            </>
          )
        }

        <section className={`flex min-w-0 flex-1 flex-col ${!isMultiPane ? 'border-l border-border' : ''}`}>
          <ErrorBoundary resetKeys={[noteId]}>
            {noteId ? <NoteEditor /> : <NotesHome />}
          </ErrorBoundary>
        </section>
      </div>
    </main>
  )
}
