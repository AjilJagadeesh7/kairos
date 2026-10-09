import { useState } from 'react'
import { Button } from '../../../atoms/Button'
import { Checkbox } from '../../../atoms/Checkbox'
import { Icon } from '../../../../icons/Icon'
import type { BoardPlan, GlobalPlan, PlanAction, PlanHandlers, PlanState } from '../../../../types'

interface RowProps {
  /** A board action or a global one: only these fields are shown. */
  action: Pick<PlanAction, 'summary' | 'changes' | 'unresolved'> & { resolved: unknown }
  pending: boolean
  checked: boolean
  /** Why Apply skipped this action (board changed since the plan). */
  skipped?: string
  onToggle: () => void
}

/** One proposed change: checkbox, one-line summary, expandable field changes. */
export function PlanRow({ action, pending, checked, skipped, onToggle }: RowProps) {
  const [open, setOpen] = useState(false)
  const blocked = !action.resolved
  const reason = action.unresolved ?? skipped

  return (
    <li className={`rounded-lg border border-border/70 px-2 py-1.5 ${blocked ? 'bg-surface2/40 opacity-60' : ''}`}>
      <div className="flex items-start gap-2">
        {blocked ? (
          <Icon name="alert-triangle" size={13} className="mt-0.5 shrink-0 text-text3" aria-label="Not applicable" />
        ) : (
          <span className={pending ? '' : 'pointer-events-none opacity-70'}>
            <Checkbox checked={checked} label={action.summary} size="md" className="mt-px" onChange={onToggle} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={`break-words text-[12.5px] leading-snug ${blocked ? 'text-text3' : 'text-text'}`}>{action.summary}</p>
          {reason && <p className="text-[11px] text-text3">{blocked ? `Not applied — ${reason}` : `Skipped — ${reason}`}</p>}
        </div>
        {action.changes.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? 'Hide field changes' : 'Show field changes'}
            onClick={() => setOpen((o) => !o)}
            className="mt-px rounded p-0.5 text-text3 hover:bg-surface2 hover:text-text"
          >
            <Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
          </button>
        )}
      </div>
      {open && (
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 border-t border-border/60 pt-1.5 text-[11px]">
          {action.changes.map((c) => (
            <div key={c.field} className="contents">
              <dt className="capitalize text-text3">{c.field}</dt>
              <dd className="min-w-0 break-words text-text">
                <span className="text-text3 line-through decoration-text3/60">{c.before}</span>
                <span className="mx-1 text-text3">→</span>
                <span className="whitespace-pre-wrap">{c.after}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  )
}

interface FooterProps {
  state: PlanState
  selectedCount: number
  busy: boolean
  /** e.g. "Applied 2 of 3." */
  appliedText: string
  /** Shown after Undo. */
  undoneText?: string
  undoable: boolean
  onApply: () => void
  onCancel: () => void
  onUndo: () => void
}

/** Apply selected / Cancel while pending; the outcome (and Undo) afterwards. */
export function PlanFooter({ state, selectedCount, busy, appliedText, undoneText, undoable, onApply, onCancel, onUndo }: FooterProps) {
  if (state === 'pending') {
    return (
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" disabled={!selectedCount || busy} onClick={onApply}>
          Apply selected{selectedCount ? ` (${selectedCount})` : ''}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    )
  }
  const text = state === 'cancelled' ? 'Cancelled — nothing was changed.'
    : state === 'undone' ? undoneText ?? 'Undone — the board is back as it was.'
    : appliedText
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-text3">
      <Icon name={state === 'applied' ? 'check' : state === 'undone' ? 'undo-2' : 'x'} size={12} />
      <span className="flex-1">{text}</span>
      {state === 'applied' && undoable && <Button variant="hollow" size="xs" onClick={onUndo}>Undo</Button>}
    </div>
  )
}

interface Props {
  messageId: string
  plan: BoardPlan | GlobalPlan
  busy: boolean
  handlers: PlanHandlers
}

/** Proposed changes (one board, or across the vault). Nothing is written until "Apply selected". */
export function PlanCard({ messageId, plan, busy, handlers, undoneText }: Props & { undoneText?: string }) {
  const pending = plan.state === 'pending'
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {plan.actions.map((a) => (
          <PlanRow
            key={a.id}
            action={a}
            pending={pending}
            checked={!!a.resolved && plan.selected.includes(a.id)}
            skipped={plan.skipped?.[a.id]}
            onToggle={() => handlers.toggle(messageId, a.id)}
          />
        ))}
      </ul>
      <PlanFooter
        state={plan.state}
        selectedCount={plan.selected.length}
        busy={busy}
        appliedText={`Applied ${plan.appliedCount ?? 0} of ${plan.actions.length}.`}
        undoneText={undoneText}
        undoable={!!plan.undoable}
        onApply={() => handlers.apply(messageId)}
        onCancel={() => handlers.cancel(messageId)}
        onUndo={() => handlers.undo(messageId)}
      />
    </div>
  )
}
