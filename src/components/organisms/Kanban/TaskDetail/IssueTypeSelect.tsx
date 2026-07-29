import { useState } from 'react'
import { IssueTypeIcon } from '../../../atoms/IssueTypeIcon'
import { ISSUE_TYPE_META } from '../../../../utils/kanban'
import { Icon } from '../../../../icons/Icon'
import type { IssueType } from '../../../../types/kanban.types'

interface Props {
  value: IssueType
  options: IssueType[]
  onChange: (type: IssueType) => void
}

/** Compact issue-type picker mirroring Jira's type dropdown. */
export function IssueTypeSelect({ value, options, onChange }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const meta = ISSUE_TYPE_META[value] ?? ISSUE_TYPE_META.task

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--text-2))] hover:border-[rgb(var(--accent))]"
      >
        <IssueTypeIcon type={value} size={16} />
        {meta.label}
        <Icon name="chevron-down" size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[150px] rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-1 shadow-lg">
            {options.map(t => (
              <button
                key={t}
                onClick={() => { onChange(t); setOpen(false) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
              >
                <IssueTypeIcon type={t} size={16} />
                {ISSUE_TYPE_META[t].label}
                {value === t && <Icon name="check" size={12} className="ml-auto text-[rgb(var(--accent))]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
