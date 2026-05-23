import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { useAppStore } from '../../../store/useAppStore'
import { EditorDraft } from './EditorDraft'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import type { EditorDraftProps } from '../../../types'
import { Icon } from '../../../icons/Icon'

export function NoteEditor(): JSX.Element {
  const { noteId }       = useParams<{ noteId?: string }>()
  const isNotesLoaded    = useAppStore((s) => s.isNotesLoaded)
  const notes            = useAppStore((s) => s.notes)
  const updateNote       = useAppStore((s) => s.updateNote)
  const loadNoteContent  = useAppStore((s) => s.loadNoteContent)

  // Track which specific noteId is mid-fetch — avoids resetting a global flag
  // on every navigation, which caused a spinner flicker for already-loaded notes.
  const [fetchingId, setFetchingId] = useState<string | null>(null)

  const activeNote = isNotesLoaded
    ? (noteId ? (notes.find(n => n.id === noteId) ?? null) : null)
    : undefined

  // Only trigger a fetch when the note's content slot is genuinely empty
  useEffect(() => {
    if (!noteId || !isNotesLoaded) return
    const note = notes.find(n => n.id === noteId)
    if (!note || note.content !== '') return   // already in memory — nothing to do
    setFetchingId(noteId)
    void loadNoteContent(noteId).then(() => setFetchingId(null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, isNotesLoaded])

  const onSave = useCallback<EditorDraftProps['onSave']>(
    (patch) => updateNote(noteId!, patch),
    [noteId, updateNote],
  )

  // Show spinner only while this specific note is being fetched
  const isFetching = fetchingId === noteId

  if (activeNote === undefined || (activeNote && isFetching)) {
    return (
      <div className="flex h-full items-center justify-center text-text3">
        <Icon name="loader-2" size={20} className="animate-spin" />
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

  return (
    <EditorErrorBoundary
      key={activeNote.id}
      noteId={activeNote.id}
      content={activeNote.content}
      onSaveRaw={content => void onSave({ title: activeNote.title, content })}
    >
      <EditorDraft key={activeNote.id} note={activeNote} onSave={onSave} />
    </EditorErrorBoundary>
  )
}
