import { Button } from '../../../atoms/Button'
import { Icon } from '../../../../icons/Icon'
import { BubblePanelShell } from '../Bubble/BubblePanelShell'
import { BubbleMessageFrame, BubbleReplyText } from '../Bubble/BubbleMessageFrame'
import { BoardFactsView } from './BoardFactsView'
import { PlanCard } from './PlanCard'
import { useBoardBubble } from '../../../../hooks/useBoardBubble'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { runBoardMessage, runBoardQuestion, runBoardSummary } from '../../../../ai/agent/boardActions'

interface BoardBubblePanelProps {
  boardId: string
  onClose: () => void
}

const OVERDUE_QUESTION = 'Which cards are overdue or blocked, and which should I tackle first?'

/** The page bubble's chat panel for one board. Loaded only when opened. */
export default function BoardBubblePanel({ boardId, onClose }: BoardBubblePanelProps) {
  const bubble = useBoardBubble(boardId)

  function openCard(key: string) {
    const { boards, setActiveTaskId } = useKanbanStore.getState()
    const task = boards.find((b) => b.id === boardId)?.tasks.find((t) => t.key === key)
    if (task) setActiveTaskId(task.id)
  }

  return (
    <BubblePanelShell
      title="Ask AI · this board"
      ariaLabel="AI assistant for this board"
      placeholder='Ask, or e.g. "add a card to fix the login bug in To Do"'
      intro="Works on this board only. Changes come as a plan you review — nothing changes until you apply it."
      config={bubble.config}
      messages={bubble.messages}
      busy={bubble.busy}
      progress={bubble.progress}
      renderMessage={(m, openSettings) => (
        <BubbleMessageFrame key={m.id} message={m} onSwitchProvider={openSettings}>
          {m.boardFacts && <BoardFactsView facts={m.boardFacts} onOpenCard={openCard} />}
          {(m.content || m.streaming || !m.boardFacts) && <BubbleReplyText message={m} />}
          {m.plan && <PlanCard messageId={m.id} plan={m.plan} busy={bubble.busy} handlers={bubble.plan} />}
        </BubbleMessageFrame>
      )}
      quickActions={
        <div className="flex flex-wrap gap-1">
          <Button variant="hollow" size="xs" disabled={bubble.busy} onClick={() => void bubble.run("What's on this board?", runBoardSummary)}>
            <Icon name="layout-dashboard" size={12} />
            What's on this board?
          </Button>
          <Button variant="hollow" size="xs" disabled={bubble.busy} onClick={() => void bubble.run('Overdue & blocked', (env) => runBoardQuestion(env, OVERDUE_QUESTION))}>
            <Icon name="alert-triangle" size={12} />
            Overdue & blocked
          </Button>
        </div>
      }
      onSend={(text) => void bubble.run(text, (env) => runBoardMessage(env, text))}
      onStop={bubble.stop}
      onClear={bubble.clear}
      onClose={onClose}
    />
  )
}
