import { useCallback, type MutableRefObject } from 'react'
import { useKanbanStore } from '../store/useKanbanStore'
import { useAiStore } from '../store/useAiStore'
import { applyPlan } from '../ai/agent/boardApply'
import { newMessage } from '../ai/agent/bubbleEnv'
import { resolveTaskTarget, taskActions } from '../ai/agent/taskPlanActions'
import { useBatchUndo } from './useBatchUndo'
import type { BubbleMessage, BubbleSink, TaskPlan, TaskPlanHandlers } from '../types'

interface Deps {
  messagesRef: MutableRefObject<BubbleMessage[]>
  add: BubbleSink['add']
  patch: BubbleSink['patch']
}

/**
 * What the user can do with a task plan in the note bubble. `apply` is the
 * only path that creates cards, on an explicit click, as one undoable batch.
 */
export function useTaskPlan({ messagesRef, add, patch }: Deps): TaskPlanHandlers {
  const batch = useBatchUndo()
  const setPlan = useCallback((id: string, update: (p: TaskPlan) => TaskPlan) =>
    patch(id, (m) => (m.taskPlan ? { ...m, taskPlan: update(m.taskPlan) } : m)), [patch])
  const pending = useCallback((id: string) => {
    const plan = messagesRef.current.find((m) => m.id === id)?.taskPlan
    return plan?.state === 'pending' ? plan : null
  }, [messagesRef])

  const toggle = useCallback((messageId: string, taskId: string) => {
    const plan = pending(messageId)
    if (!plan || plan.tasks.find((t) => t.id === taskId)?.unresolved) return
    setPlan(messageId, (p) => ({
      ...p, selected: p.selected.includes(taskId) ? p.selected.filter((x) => x !== taskId) : [...p.selected, taskId],
    }))
  }, [pending, setPlan])

  const setTarget = useCallback((messageId: string, boardId: string, columnId: string | null) => {
    if (pending(messageId)) setPlan(messageId, (p) => ({ ...p, boardId, columnId }))
  }, [pending, setPlan])

  const cancel = useCallback((messageId: string) => {
    if (pending(messageId)) setPlan(messageId, (p) => ({ ...p, state: 'cancelled' }))
  }, [pending, setPlan])

  const undo = useCallback((messageId: string) => {
    const kept = batch.undo(messageId)
    if (kept === null) return
    setPlan(messageId, (p) => ({ ...p, state: 'undone', undoable: false }))
    if (kept.length) {
      add(newMessage({ role: 'notice', content: `Kept ${kept.join(', ')} — edited after it was added, so Undo left it in place.` }))
    }
  }, [add, batch, setPlan])

  const apply = useCallback((messageId: string) => {
    const plan = pending(messageId)
    if (!plan) return
    const target = resolveTaskTarget(plan, useKanbanStore.getState().boards, useAiStore.getState().taskTarget)
    if (!target) return
    const chosen = taskActions(plan, target).filter((a) => a.resolved && plan.selected.includes(a.id))
    if (!chosen.length) return

    const result = applyPlan(target.board, chosen)
    if (!result.applied) {
      add(newMessage({ role: 'notice', content: 'Nothing was created — the board changed since you picked it.' }))
      return
    }
    useKanbanStore.getState().commitBatch(target.board.id, () => result.board)
    useAiStore.getState().setTaskTarget({ boardId: target.board.id, columnId: target.column.id })
    const keys = result.undo.created.map((id) => result.board.tasks.find((t) => t.id === id)?.key ?? '').filter(Boolean)
    setPlan(messageId, (p) => ({
      ...p, state: 'applied', appliedCount: result.applied, appliedBoardId: target.board.id,
      boardId: target.board.id, columnId: target.column.id, createdKeys: keys, undoable: true,
    }))
    batch.register(messageId, {
      boardId: target.board.id, boardTitle: target.board.title, applied: result.applied, undo: result.undo,
      onUndo: () => undo(messageId),
      onExpire: () => setPlan(messageId, (p) => ({ ...p, undoable: false })),
    })
  }, [add, batch, pending, setPlan, undo])

  return { toggle, setTarget, apply, cancel, undo }
}
