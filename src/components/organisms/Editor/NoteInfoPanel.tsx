import { useMemo, useState } from 'react'

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
  const [collapsed, setCollapsed] = useState(true)

  const stats = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    const chars = content.length
    const links = parseWikilinks(content)
    return { words, chars, linkCount: links.length }
  }, [content])

  return (
    <div className="rounded-lg border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center gap-1 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsed(v => !v)}
          className="flex flex-1 items-center gap-1.5 text-left"
          aria-expanded={!collapsed}
        >
          <Icon
            name="chevron-right"
            size={13}
            className={`shrink-0 text-text3 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          />
          <span className="text-xs font-semibold uppercase tracking-widest text-text3">Note info</span>
          {collapsed && (
            <span className="ml-1 rounded-full bg-surface3 px-1.5 py-0.5 text-[10px] text-text3">
              {stats.words} words
            </span>
          )}
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 border-t border-border px-3 pb-3 pt-2 text-xs">
          <dt className="text-text3">Created</dt>
          <dd className="text-text2">{fmt(note.createdAt)}</dd>

          <dt className="text-text3">Updated</dt>
          <dd className="text-text2">{fmt(note.updatedAt)}</dd>

          <dt className="text-text3">Words</dt>
          <dd className="text-text2">{stats.words.toLocaleString()}</dd>

          <dt className="text-text3">Characters</dt>
          <dd className="text-text2">{stats.chars.toLocaleString()}</dd>

          <dt className="text-text3">Outgoing links</dt>
          <dd className="text-text2">{stats.linkCount}</dd>

          <dt className="text-text3">Tags</dt>
          <dd className="text-text2">{note.tags.length > 0 ? note.tags.map(t => `#${t}`).join(', ') : '—'}</dd>
        </dl>
      )}
    </div>
  )
}
