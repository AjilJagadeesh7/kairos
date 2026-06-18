import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePenNoteStore } from '../store/usePenNoteStore'
import { useConfirmStore } from '../store/useConfirmStore'
import { usePaneStore } from '../store/usePaneStore'
import { usePaneId, useSidebarSlot } from '../contexts/PaneContext'
import { SidebarWrapper } from '../components/organisms/Sidebar/SidebarWrapper'
import { PenNoteEditor } from '../components/organisms/PenNote/PenNoteEditor'
import { PenNoteSidebar } from '../components/organisms/PenNote/PenNoteSidebar'
import { PenNotesHome } from '../components/organisms/PenNote/PenNotesHome'
import { VaultBanner } from '../components/common/VaultBanner'

export function PenNotePage() {
  const { penNoteId } = useParams<{ penNoteId?: string }>()
  const penNotes = usePenNoteStore(s => s.penNotes)
  const remove = usePenNoteStore(s => s.remove)
  const isLoaded = usePenNoteStore(s => s.isLoaded)
  const loadPenNotes = usePenNoteStore(s => s.loadPenNotes)
  const navigate = useNavigate()

  const paneId        = usePaneId()
  const focusedPaneId = usePaneStore(s => s.focusedPaneId)
  const isMultiPane   = usePaneStore(s => s.panes.length > 1)
  const isFocused     = paneId === focusedPaneId
  const slot          = useSidebarSlot()

  useEffect(() => {
    if (!isLoaded) void loadPenNotes()
  }, [isLoaded, loadPenNotes])

  const active = penNoteId ? penNotes.find(p => p.id === penNoteId) ?? null : null

  const handleDelete = (id: string, title: string) => {
    void useConfirmStore.getState()
      .confirm({ title: `Delete "${title || 'Untitled pen note'}"?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })
      .then(ok => { if (ok) { remove(id); navigate('/pennote') } })
  }

  const sidebar = <PenNoteSidebar />

  return (
    <main className="relative flex h-full flex-col overflow-hidden">
      <VaultBanner />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {isMultiPane
          ? isFocused && slot ? createPortal(sidebar, slot) : null
          : <SidebarWrapper>{sidebar}</SidebarWrapper>
        }

        {/* Main */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {active ? (
            <PenNoteEditor key={active.id} penNote={active} onDelete={() => handleDelete(active.id, active.title)} />
          ) : (
            <PenNotesHome />
          )}
        </section>
      </div>
    </main>
  )
}
