import { useState } from 'react'
import { FileText, Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../../store/useAppStore'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import type { KanbanTask } from '../../../../types/kanban.types'

interface LinkedNotesProps {
  boardId: string
  task: KanbanTask
}

export function LinkedNotes({ boardId, task }: LinkedNotesProps): JSX.Element {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const updateTask = useKanbanStore(s => s.updateTask)

  const allNotes = useAppStore(s => s.notes)

  const filtered = allNotes.filter(n => {
    if (task.linkedNotes.includes(n.id)) return false
    const q = query.toLowerCase()
    return n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
  })

  function linkNote(noteId: string) {
    updateTask(boardId, task.id, { linkedNotes: [...task.linkedNotes, noteId] })
    setSearching(false)
    setQuery('')
  }

  function unlinkNote(noteId: string) {
    updateTask(boardId, task.id, { linkedNotes: task.linkedNotes.filter(id => id !== noteId) })
  }

  const linkedNoteObjects = task.linkedNotes
    .map(id => allNotes.find(n => n.id === id))
    .filter(Boolean) as Array<{ id: string; title: string }>

  return (
    <div className="flex flex-col gap-2">
      {linkedNoteObjects.map(note => (
        <div key={note.id} className="group flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2">
          <FileText size={13} className="flex-shrink-0 text-[rgb(var(--accent))]" />
          <span className="flex-1 truncate text-sm text-[rgb(var(--text))]">{note.title || 'Untitled'}</span>
          <button
            onClick={() => navigate(`/notes/${note.id}`)}
            className="hidden text-xs text-[rgb(var(--accent))] underline hover:no-underline group-hover:block"
          >
            Open
          </button>
          <button
            onClick={() => unlinkNote(note.id)}
            className="hidden text-[rgb(var(--text-3))] hover:text-red-500 group-hover:block"
          >
            <X size={13} />
          </button>
        </div>
      ))}

      {searching ? (
        <div className="relative">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setSearching(false)}
            placeholder="Search notes…"
            className="w-full rounded-lg border border-[rgb(var(--accent))] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm text-[rgb(var(--text))] outline-none placeholder-[rgb(var(--text-3))]"
          />
          {filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-lg">
              {filtered.slice(0, 8).map(note => (
                <button
                  key={note.id}
                  onClick={() => linkNote(note.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
                >
                  <FileText size={12} className="flex-shrink-0 text-[rgb(var(--text-3))]" />
                  <span className="truncate">{note.title || 'Untitled'}</span>
                </button>
              ))}
            </div>
          )}
          {filtered.length === 0 && query && (
            <p className="mt-1 text-center text-xs text-[rgb(var(--text-3))]">No notes found</p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setSearching(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--accent))]"
        >
          <Plus size={12} /> Link note
        </button>
      )}
    </div>
  )
}
