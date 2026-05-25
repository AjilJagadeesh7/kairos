import { useMemo, useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { Icon } from '../../../icons/Icon'
import { ModalShell } from '../../molecules/ModalShell'

interface NotePickerModalProps {
  onPick: (noteId: string, title: string) => void
  onClose: () => void
}

export function NotePickerModal({ onPick, onClose }: NotePickerModalProps) {
  const notes = useAppStore(s => s.notes)
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q ? notes.filter(n => (n.title || 'Untitled').toLowerCase().includes(q)) : notes
  }, [notes, query])

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-[400px]" className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon name="search" size={14} className="text-text3" />
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search notes…"
          className="flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text3" />
      </div>
      <div className="max-h-[320px] overflow-y-auto py-1">
        {filtered.length === 0
          ? <p className="px-4 py-6 text-center text-[12px] text-text3">No notes found</p>
          : filtered.slice(0, 40).map(note => (
              <button key={note.id} type="button" onClick={() => onPick(note.id, note.title || 'Untitled')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-text transition hover:bg-surface2">
                <Icon name="file-text" size={13} className="shrink-0 text-accent" />
                <span className="truncate">{note.title || 'Untitled'}</span>
              </button>
            ))
        }
      </div>
    </ModalShell>
  )
}
