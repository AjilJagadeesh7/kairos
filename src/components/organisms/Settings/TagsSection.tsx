import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getAllTags, upsertTag, deleteTag } from '../../../db/schema'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { Button } from '../../atoms/Button'
import { SectionCard } from '../../molecules/SectionCard'
import type { TagRecord } from '../../../types'

const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#0ea5e9',
  '#8b5cf6',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
  '#a855f7',
]

export function TagsSection() {
  const allTags = useLiveQuery(() => getAllTags(), [], [])

  const [name,  setName]  = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [error, setError] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim().toLowerCase()
    if (!trimmed) return
    if (allTags.some(t => t.name === trimmed)) {
      setError('A tag with this name already exists.')
      return
    }
    const tag: TagRecord = { name: trimmed, color, createdAt: new Date().toISOString() }
    await upsertTag(tag)
    setName('')
    setColor(PRESET_COLORS[0])
    setError('')
  }

  const handleDelete = (tag: TagRecord) => {
    void useConfirmStore.getState()
      .confirm({
        title:        `Delete tag "#${tag.name}"?`,
        message:      'Notes using this tag will keep the tag name but lose the colour association.',
        confirmLabel: 'Delete',
        danger:       true,
      })
      .then(ok => { if (ok) void deleteTag(tag.name) })
  }

  return (
    <div className="space-y-4">
      <SectionCard title="All Tags">
        {allTags.length === 0 ? (
          <p className="text-sm text-[rgb(var(--text-3))]">No tags created yet.</p>
        ) : (
          <ul className="space-y-1">
            {allTags.map(tag => (
              <li key={tag.name}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-[rgb(var(--surface-2))]">
                <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: tag.color }} />
                <span className="flex-1 text-sm text-[rgb(var(--text))]">#{tag.name}</span>
                <button
                  type="button"
                  title="Delete tag"
                  onClick={() => handleDelete(tag)}
                  className="rounded-md p-1 text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-3))] hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Create Tag">
        <form onSubmit={e => void handleCreate(e)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--text-2))]">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="tag-name"
              className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--text-2))] placeholder:text-[rgb(var(--text-3))]"
            />
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-[rgb(var(--text-2))]">Colour</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-offset-surface' : ''}`}
                  style={{ background: c, ringColor: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: color }} />
              <span className="text-xs text-[rgb(var(--text-3))]">{color}</span>
            </div>
          </div>

          <Button type="submit" variant="primary" size="sm" disabled={!name.trim()}>
            Create Tag
          </Button>
        </form>
      </SectionCard>
    </div>
  )
}
