import { lazy } from 'react'
import { PageAiBubble } from '../Bubble/PageAiBubble'

// The panel (and with it every AI module) loads only when the bubble opens.
const BoardBubblePanel = lazy(() => import('./BoardBubblePanel'))

/** The page bubble on a kanban board. */
export function BoardAiBubble({ boardId }: { boardId: string }) {
  return (
    <PageAiBubble
      pagePath={`/kanban/${boardId}`}
      label="Ask AI about this board"
      renderPanel={(close) => <BoardBubblePanel boardId={boardId} onClose={close} />}
    />
  )
}
