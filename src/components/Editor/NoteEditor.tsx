import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { db } from '../../db/schema'
import { useAppStore } from '../../store/useAppStore'
import { EditorDraft } from './EditorDraft'

export function NoteEditor(): JSX.Element {
  const activeNoteId = useAppStore((s) => s.activeNoteId)
  const updateActiveNote = useAppStore((s) => s.updateActiveNote)

  const activeNote = useLiveQuery(
    async () => (activeNoteId ? db.notes.get(activeNoteId) : null),
    [activeNoteId],
  )

  // undefined = still loading from DB; null = no note selected; Note = ready
  if (activeNote === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-text3">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (!activeNote) {
    return (
      <div className="flex h-full items-center justify-center text-text2">
        Create or select a note to start writing.
      </div>
    )
  }

  return <EditorDraft note={activeNote} onSave={updateActiveNote} />
}
