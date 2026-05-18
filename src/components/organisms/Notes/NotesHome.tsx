import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { timeAgo } from '../../../utils/timeAgo'
import { TAG_COLOR_PALETTE } from '../../../utils/kanban'
import { TagBadge } from '../../atoms/TagBadge'
import { Button } from '../../atoms/Button'
import { NoteTemplateModal } from './NoteTemplateModal'
import type { NoteTemplate } from './NoteTemplateModal'
import type { TagRecord } from '../../../types'

function tagColor(name: string): string {
  let h = 5381
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h) ^ name.charCodeAt(i)
  }
  return TAG_COLOR_PALETTE[Math.abs(h) % TAG_COLOR_PALETTE.length]
}

export function NotesHome() {
  const navigate = useNavigate()
  const notes = useAppStore(s => s.notes)
  const createNote = useAppStore(s => s.createNote)
  const [showTemplates, setShowTemplates] = useState(false)

  const tagMap = useMemo(() => {
    const map = new Map<string, TagRecord>()
    notes.forEach(n => n.tags.forEach(name => {
      if (!map.has(name)) map.set(name, { name, color: tagColor(name), createdAt: '' })
    }))
    return map
  }, [notes])

  const handleNew = () => setShowTemplates(true)

  const handleTemplateSelect = (template: NoteTemplate) => {
    setShowTemplates(false)
    void createNote(template.id === 'blank' ? undefined : { title: template.title, content: template.content })
      .then(id => navigate(`/notes/${id}`))
  }

  return (
    <>
    {showTemplates && (
      <NoteTemplateModal onSelect={handleTemplateSelect} onClose={() => setShowTemplates(false)} />
    )}
    <div className="flex-1 overflow-y-auto bg-[rgb(var(--bg))] px-6 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-[rgb(var(--accent))]" />
            <h1 className="text-xl font-bold text-[rgb(var(--text))]">Notes</h1>
            <span className="rounded-full bg-[rgb(var(--surface-2))] px-2 py-0.5 text-xs text-[rgb(var(--text-3))]">
              {notes.length}
            </span>
          </div>
          <Button variant="primary" size="sm" onClick={handleNew} className="inline-flex items-center gap-1.5">
            <Plus size={14} /> New note
          </Button>
        </div>

        {/* Empty state */}
        {notes.length === 0 ? (
          <button
            onClick={handleNew}
            className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[rgb(var(--border))] p-16 text-center text-[rgb(var(--text-3))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]"
          >
            <BookOpen size={28} />
            <div>
              <p className="font-medium">No notes yet</p>
              <p className="mt-1 text-sm">Click to create your first note</p>
            </div>
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map(note => (
              <button
                key={note.id}
                onClick={() => navigate(`/notes/${note.id}`)}
                className="flex flex-col gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 text-left transition hover:border-[rgb(var(--accent))] hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-1 text-sm font-semibold text-[rgb(var(--text))]">
                    {note.title || 'Untitled note'}
                  </h2>
                  <span className="flex-shrink-0 text-[10px] text-[rgb(var(--text-3))]">{timeAgo(note.updatedAt)}</span>
                </div>

                {note.content && (
                  <p className="line-clamp-3 text-xs leading-relaxed text-[rgb(var(--text-3))]">
                    {note.content.replace(/[#*`\[\]]/g, '').trim()}
                  </p>
                )}

                {note.tags.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-1 pt-1">
                    {note.tags.slice(0, 4).map(tagName => {
                      const tag = tagMap.get(tagName)
                      return tag ? <TagBadge key={tagName} tag={tag} variant="sm" /> : null
                    })}
                    {note.tags.length > 4 && (
                      <span className="text-[10px] text-[rgb(var(--text-3))]">+{note.tags.length - 4}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  )
}
