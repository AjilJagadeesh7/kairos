import { useState } from 'react'
import { CHANGELOG } from '../../../data/changelog'
import { Icon } from '../../../icons/Icon'
import type { ChangelogEntry } from '../../../data/changelog'

const VERSION = __APP_VERSION__

const GROUPS = [
  { key: 'added',    label: 'Added',    color: 'text-green-500' },
  { key: 'improved', label: 'Improved', color: 'text-blue-400'  },
  { key: 'removed',  label: 'Removed',  color: 'text-rose-400'  },
  { key: 'fixed',    label: 'Fixed',    color: 'text-amber-400' },
] as const

/** "24 added · 6 fixed" — an at-a-glance summary shown on the collapsed header. */
function summarize(entry: ChangelogEntry): string {
  return GROUPS
    .map(g => ({ n: entry[g.key]?.length ?? 0, label: g.label.toLowerCase() }))
    .filter(g => g.n > 0)
    .map(g => `${g.n} ${g.label}`)
    .join(' · ')
}

/**
 * One collapsible card per release rather than every version stacked in a single
 * panel. The running version opens by default; the rest start collapsed so the
 * list stays scannable as the changelog grows.
 */
export function ChangelogAccordion(): JSX.Element {
  const [open, setOpen] = useState<Set<string>>(() => {
    const initial = CHANGELOG.find(e => e.version === VERSION) ?? CHANGELOG[0]
    return new Set(initial ? [initial.version] : [])
  })

  function toggle(version: string) {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(version)) next.delete(version)
      else next.add(version)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {CHANGELOG.map(entry => (
        <ChangelogCard
          key={entry.version}
          entry={entry}
          expanded={open.has(entry.version)}
          onToggle={() => toggle(entry.version)}
        />
      ))}
    </div>
  )
}

function ChangelogCard({ entry, expanded, onToggle }: {
  entry: ChangelogEntry
  expanded: boolean
  onToggle: () => void
}): JSX.Element {
  const panelId  = `changelog-${entry.version}`
  const isRunning = entry.version === VERSION

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-surface3"
        >
          <Icon
            name="chevron-right"
            size={14}
            className={`shrink-0 text-text3 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          />
          <span className="font-mono text-sm font-semibold text-text">v{entry.version}</span>
          <span className="text-xs text-text3">{entry.date}</span>
          {isRunning && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
              current
            </span>
          )}
          <span className="ml-auto hidden shrink-0 text-[11px] text-text3 sm:inline">
            {summarize(entry)}
          </span>
        </button>
      </h3>

      {expanded && (
        <div id={panelId} className="border-t border-border px-4 py-3">
          {entry.highlights.map(h => (
            <p key={h} className="mb-3 text-sm leading-relaxed text-text2">{h}</p>
          ))}

          {GROUPS.map(group => {
            const items = entry[group.key]
            if (!items || items.length === 0) return null
            return <ChangeGroup key={group.key} label={group.label} color={group.color} items={items} />
          })}
        </div>
      )}
    </div>
  )
}

function ChangeGroup({ label, color, items }: { label: string; color: string; items: string[] }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${color}`}>{label}</p>
      <ul className="space-y-0.5">
        {items.map(item => (
          <li key={item} className="flex items-start gap-1.5 text-xs leading-relaxed text-text2">
            <span className={`mt-1 shrink-0 ${color}`}>•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
