import { useMemo } from 'react'
import { useKanbanStore } from '../store/useKanbanStore'
import { useBubbleSession } from './useBubbleSession'
import { useBoardPlan } from './useBoardPlan'
import type { Board, BoardBubbleEnv, BubbleBaseEnv } from '../types'

/**
 * One ephemeral bubble session on a board. Actions read the live board from
 * the store at call time; only the plan card's Apply writes to it.
 */
export function useBoardBubble(boardId: string) {
  const session = useBubbleSession<BoardBubbleEnv>(useMemo(() => {
    const find = () => useKanbanStore.getState().boards.find((b) => b.id === boardId)
    const board = (): Board => {
      const b = find()
      if (!b) throw new Error('This board no longer exists.')
      return b
    }
    return {
      source: () => ({ kind: 'board' as const, id: boardId, title: find()?.title ?? 'Board' }),
      extendEnv: (base: BubbleBaseEnv): BoardBubbleEnv => ({ ...base, board, now: () => new Date() }),
    }
  }, [boardId]))

  const plan = useBoardPlan({ boardId, messagesRef: session.messagesRef, add: session.add, patch: session.patch })
  return { ...session, plan }
}
