import type { ReactNode } from 'react'
import { MarkdownText } from '../../../molecules/MarkdownText'
import { Button } from '../../../atoms/Button'
import { Icon } from '../../../../icons/Icon'
import type { BubbleMessage } from '../../../../types'

interface Props {
  message: BubbleMessage
  onSwitchProvider: () => void
  /** The assistant message's body; user, notice and error messages ignore it. */
  children?: ReactNode
}

/** Streaming or finished reply text. */
export function BubbleReplyText({ message, highlight = false }: { message: BubbleMessage; highlight?: boolean }) {
  if (!message.content) {
    return <p className="text-[13px] text-text3">{message.streaming ? 'Thinking…' : '(empty response)'}</p>
  }
  return (
    <div className={highlight ? 'rounded bg-emerald-500/10 px-1' : ''}>
      <MarkdownText text={message.content} />
      {message.streaming && <span className="animate-pulse text-text3">▍</span>}
    </div>
  )
}

/** How every bubble draws a message; page types supply the assistant body. */
export function BubbleMessageFrame({ message, onSwitchProvider, children }: Props) {
  if (message.role === 'user') {
    return (
      <div className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-surface2 px-3 py-1.5 text-[13px] text-text">
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
  // Replies read as plain text; cards (diffs, plans, offers) bring their own frame.
  return (
    <div className="group flex flex-col gap-2 px-0.5">
      {message.meta && <p className="text-[10px] text-text3">{message.meta}</p>}
      {children}
      {message.outcome && <p className="text-[10px] uppercase tracking-wider text-text3">{message.outcome}</p>}
      {message.usage && (
        <p className="-mt-1 text-[10px] text-text3 opacity-0 transition-opacity group-hover:opacity-100">
          {message.usage.promptTokens.toLocaleString('en-US')} prompt + {message.usage.completionTokens.toLocaleString('en-US')} completion tokens
        </p>
      )}
    </div>
  )
}
