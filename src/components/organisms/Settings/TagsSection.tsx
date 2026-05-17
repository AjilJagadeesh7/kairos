import { useMemo } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { TAG_COLOR_PALETTE } from '../../../utils/kanban'
import { SectionCard } from '../../molecules/SectionCard'

function tagColor(name: string): string {
  let h = 5381
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h) ^ name.charCodeAt(i)
  return TAG_COLOR_PALETTE[Math.abs(h) % TAG_COLOR_PALETTE.length]
}

export function TagsSection() {
  const notes = useAppStore((s) => s.notes)

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    notes.forEach(n => n.tags.forEach(t => tagSet.add(t)))
    return [...tagSet].sort().map(name => ({
      name,
      color: tagColor(name),
      noteCount: notes.filter(n => n.tags.includes(name)).length,
    }))
  }, [notes])

  return (
    <SectionCard title="All Tags">
      {allTags.length === 0 ? (
        <p className="text-sm text-[rgb(var(--text-3))]">
          No tags yet. Add <code className="rounded bg-[rgb(var(--surface-2))] px-1 text-xs">#tagname</code> in a note to create tags.
        </p>
      ) : (
        <ul className="space-y-1">
          {allTags.map(tag => (
            <li
              key={tag.name}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-[rgb(var(--surface-2))]"
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: tag.color }} />
              <span className="flex-1 text-sm text-[rgb(var(--text))]">#{tag.name}</span>
              <span className="text-xs text-[rgb(var(--text-3))]">{tag.noteCount} {tag.noteCount === 1 ? 'note' : 'notes'}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
