import { useState } from 'react'
import { PriorityDot } from '../../../atoms/PriorityDot'
import type { Priority } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

const OPTIONS: Array<Priority | null> = [null, 'low', 'medium', 'high', 'urgent']
const LABELS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }

interface Props {
  value: Priority | null
  onChange: (p: Priority | null) => void
}

/** Compact priority picker used in the details sidebar. */
export function PrioritySelect({ value, onChange }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]">
        {value ? <><PriorityDot priority={value} size={7} /> {LABELS[value]}</> : <span className="text-[rgb(var(--text-3))]">None</span>}
        <Icon name="chevron-down" size={11} className="text-[rgb(var(--text-3))]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[130px] rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-1 shadow-lg">
            {OPTIONS.map(p => (
              <button key={p ?? 'none'} onClick={() => { onChange(p); setOpen(false) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]">
                {p ? <PriorityDot priority={p} size={7} /> : <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--text-3))]" />}
                {p ? LABELS[p] : 'None'}
                {value === p && <Icon name="check" size={12} className="ml-auto text-[rgb(var(--accent))]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
