import { useCallback, type MutableRefObject } from 'react'
import { useKanbanStore } from '../store/useKanbanStore'
import { applyPlan } from '../ai/agent/boardApply'
import { newMessage } from '../ai/agent/bubbleEnv'
import { useBatchUndo } from './useBatchUndo'
import type { BoardPlan, BubbleMessage, BubbleSink, PlanHandlers } from '../types'

export { UNDO_WINDOW_MS } from './useBatchUndo'

interface Deps {
  boardId: string
  messagesRef: MutableRefObject<BubbleMessage[]>
  add: BubbleSink['add']
  patch: BubbleSink['patch']
}

/**
 * What the user can do with a plan card. `apply` is the only path that
 * writes to the board, and it runs only on an explicit click.
 */
export function useBoardPlan({ boardId, messagesRef, add, patch }: Deps): PlanHandlers {
  const batch = useBatchUndo()
  const board = useCallback(() => useKanbanStore.getState().boards.find((b) => b.id === boardId), [boardId])
  const setPlan = useCallback((id: string, update: (p: BoardPlan) => BoardPlan) =>
    patch(id, (m) => (m.plan ? { ...m, plan: update(m.plan) } : m)), [patch])
  const pendingPlan = useCallback((id: string) => {
    const plan = messagesRef.current.find((m) => m.id === id)?.plan
    return plan?.state === 'pending' ? plan : null
  }, [messagesRef])

  const toggle = useCallback((messageId: string, actionId: string) => {
    const plan = pendingPlan(messageId)
    if (!plan?.actions.find((a) => a.id === actionId)?.resolved) return
    setPlan(messageId, (p) => ({
      ...p,
      selected: p.selected.includes(actionId) ? p.selected.filter((x) => x !== actionId) : [...p.selected, actionId],
    }))
  }, [pendingPlan, setPlan])

  const cancel = useCallback((messageId: string) => {
    if (pendingPlan(messageId)) setPlan(messageId, (p) => ({ ...p, state: 'cancelled' }))
  }, [pendingPlan, setPlan])

  const undo = useCallback((messageId: string) => {
    const kept = batch.undo(messageId)
    if (kept === null) return
    setPlan(messageId, (p) => ({ ...p, state: 'undone', undoable: false }))
    if (kept.length) {
      add(newMessage({ role: 'notice', content: `Kept ${kept.join(', ')} — edited after it was added, so Undo left it in place.` }))
    }
  }, [add, batch, setPlan])

  const apply = useCallback((messageId: string) => {
    const plan = pendingPlan(messageId)
    const current = board()
    if (!plan || !current) return
    const chosen = plan.actions.filter((a) => a.resolved && plan.selected.includes(a.id))
    if (!chosen.length) return

    const result = applyPlan(current, chosen)
    // One write, one history entry: the whole plan is a single undo step.
    if (result.applied) useKanbanStore.getState().commitBatch(boardId, () => result.board)
    setPlan(messageId, (p) => ({
      ...p, state: 'applied', appliedCount: result.applied, skipped: result.skipped, undoable: result.applied > 0,
    }))
    if (!result.applied) {
      add(newMessage({ role: 'notice', content: 'Nothing was applied — the board changed since this plan was made.' }))
      return
    }
    batch.register(messageId, {
      boardId, boardTitle: current.title, applied: result.applied, undo: result.undo,
      onUndo: () => undo(messageId),
      onExpire: () => setPlan(messageId, (p) => ({ ...p, undoable: false })),
    })
  }, [add, batch, board, boardId, pendingPlan, setPlan, undo])

  return { toggle, apply, cancel, undo }
}
