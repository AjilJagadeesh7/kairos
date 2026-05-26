import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { Icon } from '../icons/Icon'

// ── ISO week helper ────────────────────────────────────────────────────────────

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

// ── Period key generators ─────────────────────────────────────────────────────

type TabKind = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

function getPeriodKey(kind: TabKind, date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth()
  switch (kind) {
    case 'weekly': {
      const { year, week } = getISOWeek(date)
      return `@weekly/${year}-W${String(week).padStart(2, '0')}`
    }
    case 'monthly':
      return `@monthly/${y}-${String(m + 1).padStart(2, '0')}`
    case 'quarterly':
      return `@quarterly/${y}-Q${Math.floor(m / 3) + 1}`
    case 'yearly':
      return `@yearly/${y}`
  }
}

function shiftDate(kind: TabKind, date: Date, delta: number): Date {
  const d = new Date(date)
  switch (kind) {
    case 'weekly':    d.setDate(d.getDate() + delta * 7);  break
    case 'monthly':   d.setMonth(d.getMonth() + delta);    break
    case 'quarterly': d.setMonth(d.getMonth() + delta * 3); break
    case 'yearly':    d.setFullYear(d.getFullYear() + delta); break
  }
  return d
}

const TABS: Array<{ kind: TabKind; label: string }> = [
  { kind: 'weekly',    label: 'Weekly'    },
  { kind: 'monthly',   label: 'Monthly'   },
  { kind: 'quarterly', label: 'Quarterly' },
  { kind: 'yearly',    label: 'Yearly'    },
]

const TEMPLATES: Record<TabKind, string> = {
  weekly:    '# Weekly Review: {period}\n\n## Goals\n\n## Accomplishments\n\n## Notes\n',
  monthly:   '# Monthly Review: {period}\n\n## Highlights\n\n## Goals\n\n## Reflections\n',
  quarterly: '# Quarterly Review: {period}\n\n## Key Outcomes\n\n## Learnings\n\n## Next Quarter\n',
  yearly:    '# Yearly Review: {period}\n\n## Year in Review\n\n## Major Milestones\n\n## Next Year Goals\n',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PeriodicNotesPage() {
  const navigate  = useNavigate()
  const notes     = useAppStore(s => s.notes)
  const addNote   = useAppStore(s => s.createNote)

  const [tab,    setTab]    = useState<TabKind>('weekly')
  const [cursor, setCursor] = useState<Date>(new Date())
  const [creating, setCreating] = useState(false)

  const currentKey = getPeriodKey(tab, cursor)
  const prefix     = `@${tab}/`

  const existingNote = useMemo(
    () => notes.find(n => n.title === currentKey),
    [notes, currentKey],
  )

  const periodicNotes = useMemo(
    () => notes.filter(n => n.title.startsWith(prefix)).sort((a, b) => b.title.localeCompare(a.title)),
    [notes, prefix],
  )

  async function handleCreate() {
    setCreating(true)
    try {
      const content = TEMPLATES[tab].replace('{period}', currentKey.split('/')[1] ?? currentKey)
      const id = await addNote({ title: currentKey, content })
      navigate(`/notes/${id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-bg overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text">Periodic Notes</h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 gap-6">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 w-fit">
          {TABS.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              onClick={() => { setTab(kind); setCursor(new Date()) }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === kind
                  ? 'bg-surface2 text-text shadow-sm'
                  : 'text-text2 hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Period navigator */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCursor(d => shiftDate(tab, d, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text2 hover:text-text transition-colors"
            aria-label="Previous period"
          >
            <Icon name="chevron-left" size={16} />
          </button>

          <span className="min-w-[160px] text-center font-medium text-text">{currentKey}</span>

          <button
            type="button"
            onClick={() => setCursor(d => shiftDate(tab, d, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text2 hover:text-text transition-colors"
            aria-label="Next period"
          >
            <Icon name="chevron-right" size={16} />
          </button>

          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="ml-2 rounded-md border border-border bg-surface px-3 py-1 text-xs text-text2 hover:text-text transition-colors"
          >
            Today
          </button>
        </div>

        {/* Open / Create */}
        {existingNote ? (
          <button
            type="button"
            onClick={() => navigate(`/notes/${existingNote.id}`)}
            className="flex w-fit items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20"
          >
            <Icon name="file-text" size={15} />
            Open note
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="flex w-fit items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text2 transition hover:text-text disabled:opacity-50"
          >
            <Icon name={creating ? 'loader-2' : 'plus'} size={15} className={creating ? 'animate-spin' : ''} />
            Create this note
          </button>
        )}

        {/* All periodic notes for this tab */}
        {periodicNotes.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text3">
              All {tab} notes
            </p>
            <ul className="space-y-1">
              {periodicNotes.map(n => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/notes/${n.id}`)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text2 hover:bg-surface2 hover:text-text transition-colors text-left"
                  >
                    <Icon name="file-text" size={13} className="shrink-0 text-text3" />
                    <span>{n.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
