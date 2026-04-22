import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { useAppStore } from '../store/useAppStore'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { NoteEditor } from '../components/Editor/NoteEditor'

export function NotesPage() {
  const { noteId } = useParams<{ noteId: string }>()
  const navigate = useNavigate()
  const setActiveNoteId = useAppStore((s) => s.setActiveNoteId)
  const mobileSidebarOpen = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)

  // Keep store in sync with URL param
  useEffect(() => {
    setActiveNoteId(noteId)
  }, [noteId, setActiveNoteId])

  // If at /notes with no noteId, redirect to the most-recently-updated note
  const firstNote = useLiveQuery(
    () => noteId ? null : db.notes.orderBy('updatedAt').reverse().first(),
    [noteId],
  )
  useEffect(() => {
    if (!noteId && firstNote) navigate(`/notes/${firstNote.id}`, { replace: true })
  }, [noteId, firstNote, navigate])

  return (
    <main className="relative flex h-full overflow-hidden">
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 xl:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 transition-transform duration-300 ease-in-out xl:relative xl:inset-auto xl:z-auto xl:w-[280px] xl:translate-x-0 xl:flex-shrink-0 ${
          mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Editor */}
      <section className="flex min-w-0 flex-1 flex-col border-l border-border">
        <NoteEditor />
      </section>
    </main>
  )
}
