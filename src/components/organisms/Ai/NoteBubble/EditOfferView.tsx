import { Button } from '../../../atoms/Button'
import { Icon } from '../../../../icons/Icon'
import { keepSelection } from './keepSelection'
import type { BubbleMessage, EditOfferHandlers } from '../../../../types'

/**
 * The permission card under a reply that offers an edit. Allowing runs the
 * edit; it is then previewed in the note and still needs Accept.
 */
export function EditOfferView({ message, busy, handlers }: { message: BubbleMessage; busy: boolean; handlers: EditOfferHandlers }) {
  const o = message.editOffer
  if (!o || message.streaming) return null
  if (o.state === 'granted') {
    return <p className="flex items-center gap-1 text-[11px] text-text3"><Icon name="check" size={11} /> Edit allowed — review it in the note</p>
  }
  if (o.state === 'declined') {
    return <p className="flex items-center gap-1 text-[11px] text-text3"><Icon name="x" size={11} /> Note left as it is</p>
  }
  return (
    <div role="group" aria-label="Edit permission" className="space-y-2 rounded-xl border border-border bg-surface px-3 py-2.5">
      <p className="flex items-start gap-1.5 text-[12px] leading-snug text-text">
        <Icon name="shield-check" size={14} className="mt-px shrink-0 text-text3" />
        <span>
          Let AI edit {o.target === 'selection' ? 'the selected text' : 'this note'}?
          <span className="text-text3"> You'll see the change and accept it before it's saved.</span>
        </span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Button variant="primary" size="xs" disabled={busy} onMouseDown={keepSelection} onClick={() => handlers.grant(message.id, false)}>
          Allow edit
        </Button>
        <Button variant="hollow" size="xs" disabled={busy} onMouseDown={keepSelection} onClick={() => handlers.grant(message.id, true)}>
          Always allow in this chat
        </Button>
        <Button variant="ghost" size="xs" onClick={() => handlers.decline(message.id)}>No thanks</Button>
      </div>
    </div>
  )
}
