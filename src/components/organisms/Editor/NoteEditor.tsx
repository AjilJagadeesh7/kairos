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
  const [contentReady, setContentReady] = useState(false)

  const activeNote = isNotesLoaded
    ? (noteId ? (notes.find(n => n.id === noteId) ?? null) : null)
    : undefined

  // If phase-1 metadata load gave us an empty content string, fetch it on demand
  useEffect(() => {
    setContentReady(false)
    if (!noteId || !isNotesLoaded) return
    const note = notes.find(n => n.id === noteId)
    if (!note) { setContentReady(true); return }
    if (note.content !== '') { setContentReady(true); return }
    void loadNoteContent(noteId).then(() => setContentReady(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, isNotesLoaded])

  const onSave = useCallback<EditorDraftProps['onSave']>(
    (patch) => updateNote(noteId!, patch),
    [noteId, updateNote],
  )

  if (activeNote === undefined || (activeNote && !contentReady)) {
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
