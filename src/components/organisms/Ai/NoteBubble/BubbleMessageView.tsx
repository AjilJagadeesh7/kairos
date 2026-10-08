import { Button } from '../../../atoms/Button'
import { Icon } from '../../../../icons/Icon'
import { DiffView } from './DiffView'
import { BubbleSuggestionView } from './BubbleSuggestionView'
import { REWRITE_STYLES } from '../../../../ai/prompts/noteBubble.v1'
import type { BubbleMessage, SuggestionHandlers } from '../../../../types'

interface Props {
  message: BubbleMessage
  busy: boolean
  handlers: SuggestionHandlers
  onSwitchProvider: () => void
}

function Body({ message }: { message: BubbleMessage }) {
  const s = message.suggestion
  if (s?.kind === 'replace' && s.proposed && !message.streaming && s.state !== 'rejected') {
    return (
      <>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text3">{REWRITE_STYLES[s.style].label}</p>
        <DiffView before={s.original} after={s.proposed} />
      </>
    )
  }
  if (!message.content) {
    return <p className="text-[13px] text-text3">{message.streaming ? 'Thinking…' : '(empty response)'}</p>
  }
  return (
    <p className={`whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text ${
      s?.kind === 'insert' && s.state === 'pending' && !message.streaming ? 'rounded bg-emerald-500/10 px-1' : ''}`}>
      {message.content}
      {message.streaming && <span className="ml-0.5 animate-pulse text-text3">▍</span>}
    </p>
  )
}

export function BubbleMessageView({ message, busy, handlers, onSwitchProvider }: Props) {
  if (message.role === 'user') {
    return (
      <div className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-accent/10 px-3 py-1.5 text-[13px] text-text">
        {message.content}
      </div>
    )
  }
  if (message.role === 'notice') {
    return <p className="px-1 text-[12px] italic text-text3">{message.content}</p>
  }
  if (message.role === 'error') {
    return (
      <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[12px] text-red-600 dark:text-red-400">
        <p className="flex items-start gap-1.5"><Icon name="alert-triangle" size={12} className="mt-0.5 shrink-0" />{message.content}</p>
        <Button variant="hollow" size="xs" onClick={onSwitchProvider}>Switch provider</Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-3 py-2">
      {message.meta && <p className="text-[10px] text-text3">{message.meta}</p>}
      <Body message={message} />
      <BubbleSuggestionView message={message} busy={busy} handlers={handlers} />
      {message.usage && (
        <p className="text-[10px] text-text3">
          {message.usage.promptTokens.toLocaleString('en-US')} prompt + {message.usage.completionTokens.toLocaleString('en-US')} completion tokens
        </p>
      )}
    </div>
  )
}
