import { useState } from 'react'
import { Button } from '../../../atoms/Button'
import { Checkbox } from '../../../atoms/Checkbox'
import { Icon } from '../../../../icons/Icon'
import type { BoardPlan, PlanAction, PlanHandlers } from '../../../../types'

interface Props {
  messageId: string
  plan: BoardPlan
  busy: boolean
  handlers: PlanHandlers
}

function ActionRow({ action, plan, onToggle }: { action: PlanAction; plan: BoardPlan; onToggle: () => void }) {
  const [open, setOpen] = useState(false)
  const pending = plan.state === 'pending'
  const blocked = !action.resolved
  const skipped = plan.skipped?.[action.id]
  const reason = action.unresolved ?? skipped
  const checked = !blocked && plan.selected.includes(action.id)

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

function Footer({ messageId, plan, busy, handlers }: Props) {
  const count = plan.selected.length
  if (plan.state === 'pending') {
    return (
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" disabled={!count || busy} onClick={() => handlers.apply(messageId)}>
          Apply selected{count ? ` (${count})` : ''}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handlers.cancel(messageId)}>Cancel</Button>
      </div>
    )
  }
  const text = plan.state === 'cancelled' ? 'Cancelled — nothing was changed.'
    : plan.state === 'undone' ? 'Undone — the board is back as it was.'
    : `Applied ${plan.appliedCount ?? 0} of ${plan.actions.length}.`
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-text3">
      <Icon name={plan.state === 'applied' ? 'check' : plan.state === 'undone' ? 'undo-2' : 'x'} size={12} />
      <span className="flex-1">{text}</span>
      {plan.state === 'applied' && plan.undoable && (
        <Button variant="hollow" size="xs" onClick={() => handlers.undo(messageId)}>Undo</Button>
      )}
    </div>
  )
}

/** Proposed board changes. Nothing is written until "Apply selected". */
export function PlanCard(props: Props) {
  const { messageId, plan, handlers } = props
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {plan.actions.map((a) => (
          <ActionRow key={a.id} action={a} plan={plan} onToggle={() => handlers.toggle(messageId, a.id)} />
        ))}
      </ul>
      <Footer {...props} />
    </div>
  )
}
