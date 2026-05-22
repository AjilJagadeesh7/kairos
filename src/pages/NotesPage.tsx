import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { usePaneStore } from '../store/usePaneStore'
import { usePaneId, useSidebarSlot } from '../contexts/PaneContext'
import { Sidebar } from '../components/organisms/Sidebar/Sidebar'
import { SidebarWrapper } from '../components/organisms/Sidebar/SidebarWrapper'
import { NoteEditor } from '../components/organisms/Editor/NoteEditor'
import { NotesHome } from '../components/organisms/Notes/NotesHome'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { VaultBanner } from '../components/common/VaultBanner'

export function NotesPage() {
  const { noteId }           = useParams<{ noteId: string }>()
  const setActiveNoteId      = useAppStore((s) => s.setActiveNoteId)
  const paneId               = usePaneId()
  const focusedPaneId        = usePaneStore(s => s.focusedPaneId)
  const isMultiPane          = usePaneStore(s => s.panes.length > 1)
  const isFocused            = paneId === focusedPaneId
  const slot                 = useSidebarSlot()

  // Only the focused pane updates the global activeNoteId
  useEffect(() => {
    if (!isMultiPane || isFocused) setActiveNoteId(noteId)
  }, [noteId, setActiveNoteId, isMultiPane, isFocused])

  const sidebar = <Sidebar />

  return (
    <main className="relative flex h-full flex-col overflow-hidden">
      <VaultBanner />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">

        {isMultiPane
          ? isFocused && slot ? createPortal(sidebar, slot) : null
          : <SidebarWrapper>{sidebar}</SidebarWrapper>
        }

        <section className="flex min-w-0 flex-1 flex-col">
          <ErrorBoundary resetKeys={[noteId]}>
            {noteId ? <NoteEditor /> : <NotesHome />}
          </ErrorBoundary>
        </section>
      </div>
    </main>
  )
}
