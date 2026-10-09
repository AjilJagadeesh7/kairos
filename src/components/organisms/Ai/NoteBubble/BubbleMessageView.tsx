import { DiffView } from './DiffView'
import { BubbleSuggestionView } from './BubbleSuggestionView'
import { TaskPlanCard } from './TaskPlanCard'
import { BubbleMessageFrame, BubbleReplyText } from '../Bubble/BubbleMessageFrame'
import { REWRITE_STYLES } from '../../../../ai/prompts/noteBubble.v1'
import type { BubbleMessage, SuggestionHandlers, TaskPlanHandlers } from '../../../../types'

interface Props {
  message: BubbleMessage
  busy: boolean
  handlers: SuggestionHandlers
  taskHandlers: TaskPlanHandlers
  onSwitchProvider: () => void
}

function Body({ message }: { message: BubbleMessage }) {
  const s = message.suggestion
  if (s?.kind === 'replace' && s.proposed && !message.streaming && s.state !== 'rejected') {
    return (
      <>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text3">{s.style ? REWRITE_STYLES[s.style].label : 'Edit'}</p>
        <DiffView before={s.original} after={s.proposed} />
      </>
    )
  }
  return <BubbleReplyText message={message} highlight={s?.kind === 'insert' && s.state === 'pending' && !message.streaming} />
}

export function BubbleMessageView({ message, busy, handlers, taskHandlers, onSwitchProvider }: Props) {
  return (
    <BubbleMessageFrame message={message} onSwitchProvider={onSwitchProvider}>
      <Body message={message} />
      <BubbleSuggestionView message={message} busy={busy} handlers={handlers} />
      {message.taskPlan && <TaskPlanCard messageId={message.id} plan={message.taskPlan} busy={busy} handlers={taskHandlers} />}
    </BubbleMessageFrame>
  )
}
