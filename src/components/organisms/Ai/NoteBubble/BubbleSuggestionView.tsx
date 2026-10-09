import { useState } from 'react'
import { Button } from '../../../atoms/Button'
import { Pill } from '../../../atoms/Pill'
import { Icon } from '../../../../icons/Icon'
import { isTouch } from '../../../../utils/platform'
import type { BubbleMessage, SuggestionHandlers } from '../../../../types'

function Status({ icon, children }: { icon?: 'check' | 'x' | 'alert-triangle'; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1 text-[11px] text-text3">
      {icon && <Icon name={icon} size={11} />}
      {children}
    </p>
  )
}

/** The buttons under a suggestion. Each one is an explicit user decision. */
export function BubbleSuggestionView({ message, busy, handlers }: { message: BubbleMessage; busy: boolean; handlers: SuggestionHandlers }) {
  const s = message.suggestion
  const [picked, setPicked] = useState<string[]>([])
  if (!s || message.streaming) return null
  const id = message.id

  switch (s.kind) {
    case 'replace':
    case 'insert':
      if (!s.proposed) return null
      if (s.state === 'pending') {
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="primary" size="xs" onClick={() => handlers.accept(id)}>
              <Icon name="check" size={12} /> Accept
            </Button>
            <Button variant="hollow" size="xs" onClick={() => handlers.reject(id)}>Reject</Button>
            <Button variant="ghost" size="xs" disabled={busy} onClick={() => handlers.retry(id)}>
              <Icon name="refresh-cw" size={12} /> Retry
            </Button>
            <span className="text-[10px] text-text3">Previewed in the note</span>
          </div>
        )
      }
      if (s.state === 'accepted') {
        return <Status icon="check">Applied to the note{isTouch() ? '' : ' — Ctrl+Z undoes it'}</Status>
      }
      if (s.state === 'stale') {
        return (
          <div className="flex items-center gap-2">
            <Status icon="alert-triangle">Not applied — the text changed</Status>
            <Button variant="ghost" size="xs" disabled={busy} onClick={() => handlers.retry(id)}>Retry</Button>
          </div>
        )
      }
      return <Status icon="x">Discarded</Status>

    case 'summary':
      return s.inserted
        ? <Status icon="check">Inserted at the top of the note</Status>
        : <Button variant="hollow" size="xs" className="self-start" onClick={() => handlers.insertSummary(id)}>Insert at top of note</Button>

    case 'title':
      return (
        <div className="flex flex-col gap-1">
          {s.options.map((t) => (
            <div key={t} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-[13px] text-text">{t}</span>
              {s.applied === t
                ? <Status icon="check">Applied</Status>
                : <Button variant="link" size="xs" onClick={() => handlers.applyTitle(id, t)}>Use</Button>}
            </div>
          ))}
        </div>
      )

    case 'tags':
      if (s.applied) return <Status icon="check">Added {s.applied.map((t) => `#${t}`).join(' ')}</Status>
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1">
            {s.options.map((t) => (
              <Pill key={t} selected={picked.includes(t)}
                onClick={() => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}>
                #{t}
              </Pill>
            ))}
          </div>
          <Button variant="hollow" size="xs" className="self-start" disabled={!picked.length}
            onClick={() => handlers.applyTags(id, picked)}>
            Add {picked.length || ''} tag{picked.length === 1 ? '' : 's'}
          </Button>
        </div>
      )
  }
}
