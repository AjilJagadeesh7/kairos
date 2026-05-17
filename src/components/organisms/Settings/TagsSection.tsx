import { useMemo, useState } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { TAG_COLOR_PALETTE } from '../../../utils/kanban'
import { ColorPicker } from '../../molecules/ColorPicker'
import { SectionCard } from '../../molecules/SectionCard'
import { Button } from '../../atoms/Button'

function hashColor(name: string): string {
  let h = 5381
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h) ^ name.charCodeAt(i)
  return TAG_COLOR_PALETTE[Math.abs(h) % TAG_COLOR_PALETTE.length]
}

export function TagsSection() {
  const notes           = useAppStore(s => s.notes)
  const noteTagColors   = useAppStore(s => s.noteTagColors)
  const setNoteTagColor = useAppStore(s => s.setNoteTagColor)
  const removeNoteTag   = useAppStore(s => s.removeNoteTag)

  const [newName,      setNewName]      = useState('')
  const [newColor,     setNewColor]     = useState(TAG_COLOR_PALETTE[0])
  const [editingTag,   setEditingTag]   = useState<string | null>(null)

  // auto-preview color as user types
  const previewColor = newName.trim() ? (noteTagColors[newName.trim().toLowerCase()] ?? hashColor(newName.trim().toLowerCase())) : newColor

  const allTags = useMemo(() => {
    // All tag names from notes
    const fromNotes = new Map<string, number>()
    notes.forEach(n => n.tags.forEach(t => { fromNotes.set(t, (fromNotes.get(t) ?? 0) + 1) }))

    // Tags only in noteTagColors (pre-registered, not yet used in any note)
    const preRegistered = Object.keys(noteTagColors).filter(t => !fromNotes.has(t))

    const combined = [
      ...Array.from(fromNotes.entries()).map(([name, count]) => ({ name, count })),
      ...preRegistered.map(name => ({ name, count: 0 })),
    ]
    combined.sort((a, b) => a.name.localeCompare(b.name))
    return combined
  }, [notes, noteTagColors])

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim().toLowerCase()
    if (!name) return
    setNoteTagColor(name, newColor)
    setNewName('')
    setNewColor(TAG_COLOR_PALETTE[0])
  }

  function resolveColor(name: string) {
    return noteTagColors[name] ?? hashColor(name)
  }

  return (
    <div className="space-y-6">
      {/* Add tag form */}
      <SectionCard title="Add Tag">
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="flex gap-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
              style={{ backgroundColor: previewColor }}
            />
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="tag-name…"
              className="flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--accent))] placeholder:text-[rgb(var(--text-3))]"
            />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[rgb(var(--text-3))]">Color</p>
            <ColorPicker value={newColor} onChange={setNewColor} cols={6} />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!newName.trim()}
            className="inline-flex items-center gap-1.5"
          >
            <Plus size={13} /> Add Tag
          </Button>
        </form>
      </SectionCard>

      {/* All tags list */}
      <SectionCard title="All Tags">
        {allTags.length === 0 ? (
          <p className="text-sm text-[rgb(var(--text-3))]">
            No tags yet. Add tags above, or use{' '}
            <code className="rounded bg-[rgb(var(--surface-2))] px-1 text-xs">#tagname</code> in a note.
          </p>
        ) : (
          <ul className="space-y-1">
            {allTags.map(tag => (
              <li key={tag.name}>
                <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-[rgb(var(--surface-2))]">
                  {/* Color swatch — click to toggle inline editor */}
                  <button
                    type="button"
                    title="Change color"
                    onClick={() => setEditingTag(editingTag === tag.name ? null : tag.name)}
                    className="h-4 w-4 shrink-0 rounded-full transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]/50"
                    style={{ background: resolveColor(tag.name) }}
                  />
                  <span className="flex-1 text-sm text-[rgb(var(--text))]">#{tag.name}</span>
                  <span className="text-xs text-[rgb(var(--text-3))]">
                    {tag.count > 0 ? `${tag.count} ${tag.count === 1 ? 'note' : 'notes'}` : 'unused'}
                  </span>
                  {/* Reset to hash color */}
                  {noteTagColors[tag.name] && (
                    <button
                      type="button"
                      title="Reset to default color"
                      onClick={() => { removeNoteTag(tag.name); setEditingTag(null) }}
                      className="text-[rgb(var(--text-3))] opacity-0 transition hover:text-[rgb(var(--text))] group-hover:opacity-100 [li:hover_&]:opacity-100"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                  {/* Delete pre-registered unused tag */}
                  {tag.count === 0 && (
                    <button
                      type="button"
                      title="Delete tag"
                      onClick={() => { removeNoteTag(tag.name); setEditingTag(null) }}
                      className="text-[rgb(var(--text-3))] opacity-0 transition hover:text-red-400 [li:hover_&]:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* Inline color picker */}
                {editingTag === tag.name && (
                  <div className="mx-2 mb-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3">
                    <ColorPicker
                      value={resolveColor(tag.name)}
                      onChange={color => setNoteTagColor(tag.name, color)}
                      cols={6}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
