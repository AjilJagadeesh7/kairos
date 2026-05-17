import { Loader2 } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { EditorDraft } from './EditorDraft'

export function NoteEditor(): JSX.Element {
  const activeNoteId = useAppStore((s) => s.activeNoteId)
  const isNotesLoaded = useAppStore((s) => s.isNotesLoaded)
  const notes = useAppStore((s) => s.notes)
  const updateActiveNote = useAppStore((s) => s.updateActiveNote)

  const activeNote = isNotesLoaded
    ? (activeNoteId ? (notes.find(n => n.id === activeNoteId) ?? null) : null)
    : undefined

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
