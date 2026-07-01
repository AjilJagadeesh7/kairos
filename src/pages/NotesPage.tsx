import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { usePaneStore } from '../store/usePaneStore'
import { usePaneId } from '../contexts/PaneContext'
import { SidebarShell } from '../components/organisms/Sidebar/SidebarShell'
import { NoteEditor } from '../components/organisms/Editor/NoteEditor'
import { NotesHome } from '../components/organisms/Notes/NotesHome'

export function NotesPage() {
  const { noteId }      = useParams<{ noteId: string }>()
  const setActiveNoteId = useAppStore((s) => s.setActiveNoteId)
  const paneId          = usePaneId()
  const focusedPaneId   = usePaneStore(s => s.focusedPaneId)
  const isMultiPane     = usePaneStore(s => s.panes.length > 1)
  const isFocused       = paneId === focusedPaneId

  // Only the focused pane updates the global activeNoteId
  useEffect(() => {
    if (!isMultiPane || isFocused) setActiveNoteId(noteId)
  }, [noteId, setActiveNoteId, isMultiPane, isFocused])

  return (
    <SidebarShell resetKeys={[noteId]}>
      {noteId ? <NoteEditor /> : <NotesHome />}
    </SidebarShell>
  )
}
