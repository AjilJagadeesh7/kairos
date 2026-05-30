import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../store/useAppStore'
import { parseWikilinks } from '../../../utils/wikilinks'
import { SectionLabel } from '../../atoms/SectionLabel'
import type { Note } from '../../../types'

interface JournalBacklinksPanelProps {
  /** The journal entry date (YYYY-MM-DD) whose backlinks we show. */
  date: string
  /** Human-readable date label, also matched as a wikilink target. */
  label: string
}

/** Notes that wikilink to this journal entry, by raw date or formatted label.
 *  Mirrors the Notes editor's BacklinksSection. */
export function JournalBacklinksPanel({ date, label }: JournalBacklinksPanelProps) {
  const notes = useAppStore((s) => s.notes)
  const navigate = useNavigate()

  const backlinks = useMemo(() => {
    const targets = new Set([date.toLowerCase(), label.toLowerCase()])
    return notes.filter((n: Note) =>
      parseWikilinks(n.content).some((l: string) => targets.has(l.toLowerCase())),
    )
  }, [notes, date, label])

  return (
    <div>
      <SectionLabel className="px-3 pt-3 pb-1">
        Backlinks
        {backlinks.length > 0 && (
          <span className="ml-1.5 rounded-full bg-surface3 px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal">
            {backlinks.length}
          </span>
        )}
      </SectionLabel>

      <div className="px-2 pb-2">
        {backlinks.length === 0 ? (
          <p className="px-1 text-xs italic text-text3">No notes link to this day yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {backlinks.map((n: Note) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/notes/${n.id}`)}
                  className="group w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-left transition hover:border-accent/40"
                >
                  <p className="text-xs font-medium text-text group-hover:text-accent transition-colors">
                    {n.title || 'Untitled note'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
