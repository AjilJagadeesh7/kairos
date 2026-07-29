import { useMemo } from 'react'
import { usePenNoteStore } from '../../../store/usePenNoteStore'
import { useAppStore } from '../../../store/useAppStore'
import { tagColorFromName as tagColor } from '../../../utils/kanban'
import { TagSelector } from '../../molecules/TagSelector'
import { SectionLabel } from '../../atoms/SectionLabel'
import { ToggleSwitch } from '../../atoms/ToggleSwitch'
import type { PenNote, TagRecord } from '../../../types'

function fmt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between px-3 py-1 text-xs">
      <span className="text-text3">{label}</span>
      <span className="text-text2">{value}</span>
    </div>
  )
}

export function PenNoteRightSidebar({ penNote }: { penNote: PenNote }): JSX.Element {
  const setTags = usePenNoteStore(s => s.setTags)
  const setNoSync = usePenNoteStore(s => s.setNoSync)
  const penNotes = usePenNoteStore(s => s.penNotes)
  const noteTagColors = useAppStore(s => s.noteTagColors)
  const setNoteTagColor = useAppStore(s => s.setNoteTagColor)

  // Offer tags already used across notes and pen notes for quick selection.
  const noteTagNames = useAppStore(s => {
    const set = new Set<string>()
    s.notes.forEach(n => n.tags.forEach(t => set.add(t)))
    return [...set].sort().join('\0')
  })

  const availableTags = useMemo((): TagRecord[] => {
    const names = new Set<string>(noteTagNames ? noteTagNames.split('\0') : [])
    penNotes.forEach(p => p.tags.forEach(t => names.add(t)))
    return [...names].filter(Boolean).sort().map(name => ({
      name, color: noteTagColors[name] ?? tagColor(name), createdAt: '',
    }))
  }, [noteTagNames, penNotes, noteTagColors])

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <SectionLabel className="px-3 pt-3 pb-1">Tags</SectionLabel>
      <div className="px-2 pb-2">
        <TagSelector
          selectedTags={penNote.tags}
          onTagsChange={tags => setTags(penNote.id, tags)}
          onTagCreate={(name, color) => setNoteTagColor(name, color)}
          availableTags={availableTags}
        />
      </div>

      <SectionLabel className="px-3 pt-3 pb-1">Properties</SectionLabel>
      <Row label="Created" value={fmt(penNote.createdAt)} />
      <Row label="Updated" value={fmt(penNote.updatedAt)} />
      <Row label="Strokes" value={String(penNote.strokes.length)} />
      <Row label="Page height" value={`${Math.round(penNote.height)} px`} />

      <SectionLabel className="px-3 pt-4 pb-1">Sync</SectionLabel>
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs text-text2">Keep local-only</span>
        <ToggleSwitch
          checked={!!penNote.noSync}
          onChange={v => setNoSync(penNote.id, v)}
          size="sm"
          label="Keep local-only"
        />
      </div>
    </div>
  )
}
