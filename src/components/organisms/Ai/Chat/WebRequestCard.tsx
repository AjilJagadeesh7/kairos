import { Button } from '../../../atoms/Button'
import { Icon } from '../../../../icons/Icon'
import type { PendingWebRequest } from '../../../../types'

/** Shows the exact query or URL before it is sent (PRD: "Ask before each request"). */
export function WebRequestCard({ pending }: { pending: PendingWebRequest }) {
  const r = pending.request
  return (
    <div role="alertdialog" aria-label="Web request" className="flex flex-col gap-2 rounded-xl border border-accent/60 bg-surface px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-text">
        <Icon name="globe" size={13} />
        {r.kind === 'search' ? `Search ${r.provider} for:` : 'Read this page:'}
      </p>
      <p className="break-all rounded-md bg-surface2 px-2 py-1 font-mono text-[12px] text-text">{r.kind === 'search' ? r.query : r.url}</p>
      <p className="text-[11px] text-text3">
        {r.kind === 'search' ? 'Only this query is sent to the search provider.' : 'Kairos downloads this page directly; nothing else is sent.'}
      </p>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={() => pending.answer(true)}>Allow</Button>
        <Button variant="ghost" size="sm" onClick={() => pending.answer(false)}>Don't allow</Button>
      </div>
    </div>
  )
}
