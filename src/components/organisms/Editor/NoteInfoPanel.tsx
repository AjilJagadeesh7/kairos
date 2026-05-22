import { useMemo } from 'react'

import { parseWikilinks } from '../../../utils/wikilinks'
import type { Note } from '../../../types'
import { Icon } from '../../../icons/Icon'

interface NoteInfoPanelProps {
  note: Note
  content: string
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    + ' at '
    + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function NoteInfoPanel({ note, content }: NoteInfoPanelProps) {
  const stats = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    const chars = content.length
    const links = parseWikilinks(content)
    return { words, chars, linkCount: links.length }
  }, [content])

  return (
    <details className="group mt-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs font-semibold text-[rgb(var(--text-2))] transition hover:text-[rgb(var(--text))]">
        <Icon name="info" size={13} className="text-[rgb(var(--accent))]" />
        Note info
        <span className="ml-auto text-[10px] font-normal text-[rgb(var(--text-3))] group-open:hidden">
          {stats.words} words
        </span>
      </summary>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-3 pb-3 pt-1 text-xs">
        <dt className="text-[rgb(var(--text-3))]">Created</dt>
        <dd className="text-[rgb(var(--text-2))]">{fmt(note.createdAt)}</dd>

        <dt className="text-[rgb(var(--text-3))]">Updated</dt>
        <dd className="text-[rgb(var(--text-2))]">{fmt(note.updatedAt)}</dd>

        <dt className="text-[rgb(var(--text-3))]">Words</dt>
        <dd className="text-[rgb(var(--text-2))]">{stats.words.toLocaleString()}</dd>

        <dt className="text-[rgb(var(--text-3))]">Characters</dt>
        <dd className="text-[rgb(var(--text-2))]">{stats.chars.toLocaleString()}</dd>

        <dt className="text-[rgb(var(--text-3))]">Outgoing links</dt>
        <dd className="text-[rgb(var(--text-2))]">{stats.linkCount}</dd>

        <dt className="text-[rgb(var(--text-3))]">Tags</dt>
        <dd className="text-[rgb(var(--text-2))]">{note.tags.length > 0 ? note.tags.map(t => `#${t}`).join(', ') : '—'}</dd>
      </dl>
    </details>
  )
}
