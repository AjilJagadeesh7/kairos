import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePenNoteStore } from '../store/usePenNoteStore'
import { useConfirmStore } from '../store/useConfirmStore'
import { PenNoteEditor } from '../components/organisms/PenNote/PenNoteEditor'
import { PenNoteSidebar } from '../components/organisms/PenNote/PenNoteSidebar'
import { EmptyState } from '../components/molecules/EmptyState'
import { VaultBanner } from '../components/common/VaultBanner'

export function PenNotePage() {
  const { penNoteId } = useParams<{ penNoteId?: string }>()
  const penNotes = usePenNoteStore(s => s.penNotes)
  const create = usePenNoteStore(s => s.create)
  const remove = usePenNoteStore(s => s.remove)
  const isLoaded = usePenNoteStore(s => s.isLoaded)
  const loadPenNotes = usePenNoteStore(s => s.loadPenNotes)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoaded) void loadPenNotes()
  }, [isLoaded, loadPenNotes])

  const active = penNoteId ? penNotes.find(p => p.id === penNoteId) ?? null : null

  const handleCreate = () => navigate(`/pennote/${create()}`)

  const handleDelete = (id: string, title: string) => {
    void useConfirmStore.getState()
      .confirm({ title: `Delete "${title || 'Untitled pen note'}"?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })
      .then(ok => { if (ok) { remove(id); navigate('/pennote') } })
  }

  return (
    <main className="relative flex h-full flex-col overflow-hidden">
      <VaultBanner />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Folder-structured sidebar */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-border">
          <PenNoteSidebar />
        </aside>

        {/* Main */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {active ? (
            <PenNoteEditor key={active.id} penNote={active} onDelete={() => handleDelete(active.id, active.title)} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon="pen-line"
                title="No pen note open"
                description="Create a handwriting note and write with your pen or finger."
                action={{ label: 'New pen note', onClick: handleCreate }}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
