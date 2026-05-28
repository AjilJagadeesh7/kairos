import { useCallback } from 'react'
import { useParams } from 'react-router-dom'

import { useAppStore } from '../../../store/useAppStore'
import { EditorDraft } from './EditorDraft'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import type { EditorDraftProps } from '../../../types'
import { Icon } from '../../../icons/Icon'

export function NoteEditor(): JSX.Element {
  const { noteId }    = useParams<{ noteId?: string }>()
  const isNotesLoaded = useAppStore((s) => s.isNotesLoaded)
  const notes         = useAppStore((s) => s.notes)
  const updateNote    = useAppStore((s) => s.updateNote)

  // isNotesLoaded is only true after Phase 2 (full content loaded), so notes
  // always have their content populated by the time we reach here.
  const activeNote = isNotesLoaded
    ? (noteId ? (notes.find(n => n.id === noteId) ?? null) : null)
    : undefined

  const onSave = useCallback<EditorDraftProps['onSave']>(
    (patch) => updateNote(noteId!, patch),
    [noteId, updateNote],
  )

  if (activeNote === undefined) {
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
      onSaveRaw={content => void onSave({ title: activeNote.title, content, embedding: [], contentHash: '' })}
    >
      <EditorDraft key={activeNote.id} note={activeNote} onSave={onSave} />
    </EditorErrorBoundary>
  )
}
