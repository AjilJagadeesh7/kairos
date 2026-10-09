import { useCallback, useRef, type MutableRefObject } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useKanbanStore } from '../store/useKanbanStore'
import { applyGlobalPlan, revertGlobalPlan, type VaultWriter } from '../ai/agent/globalApply'
import { newMessage } from '../ai/agent/bubbleEnv'
import { useBatchUndo } from './useBatchUndo'
import type { BubbleMessage, BubbleSink, GlobalPlan, PlanHandlers } from '../types'

/** The vault through the existing stores: the same paths a user's own edits take. */
const storeWriter: VaultWriter = {
  boards: () => useKanbanStore.getState().boards,
  commitBoard: (boardId, next) => useKanbanStore.getState().commitBatch(boardId, () => next),
  notes: () => useAppStore.getState().notes,
  createNote: (n) => useAppStore.getState().createNote({ ...n, activate: false }),
  setNoteContent: (id, content) => useAppStore.getState().setNoteContent(id, content),
  // deleteNoteById captures the note in the trash first (soft delete).
  trashNote: (id) => useAppStore.getState().deleteNoteById(id),
}

function targetText(touched: string[]): string {
  const boards = touched.filter((t) => !t.startsWith('"'))
  const notes = touched.length - boards.length
  const parts = [...boards, notes ? `${notes} note${notes === 1 ? '' : 's'}` : '']
  return parts.filter(Boolean).join(' and ') || 'your vault'
}

interface Deps {
  messagesRef: MutableRefObject<BubbleMessage[]>
  add: BubbleSink['add']
  patch: BubbleSink['patch']
}

/**
 * What the user can do with a plan card in the global chat. `apply` is the
 * only path that writes, on an explicit click, as one batch with one Undo.
 */
export function useGlobalPlan({ messagesRef, add, patch }: Deps): PlanHandlers {
  const batch = useBatchUndo()
  const applying = useRef(new Set<string>())
  const setPlan = useCallback((id: string, update: (p: GlobalPlan) => GlobalPlan) =>
    patch(id, (m) => (m.globalPlan ? { ...m, globalPlan: update(m.globalPlan) } : m)), [patch])
  const pendingPlan = useCallback((id: string) => {
    const plan = messagesRef.current.find((m) => m.id === id)?.globalPlan
    return plan?.state === 'pending' && !applying.current.has(id) ? plan : null
  }, [messagesRef])

  const toggle = useCallback((messageId: string, actionId: string) => {
    const plan = pendingPlan(messageId)
    if (!plan?.actions.find((a) => a.id === actionId)?.resolved) return
    setPlan(messageId, (p) => ({
      ...p, selected: p.selected.includes(actionId) ? p.selected.filter((x) => x !== actionId) : [...p.selected, actionId],
    }))
  }, [pendingPlan, setPlan])

  const cancel = useCallback((messageId: string) => {
    if (pendingPlan(messageId)) setPlan(messageId, (p) => ({ ...p, state: 'cancelled' }))
  }, [pendingPlan, setPlan])

  const undo = useCallback((messageId: string) => {
    void batch.undo(messageId).then((kept) => {
      if (kept === null) return
      setPlan(messageId, (p) => ({ ...p, state: 'undone', undoable: false }))
      if (kept.length) add(newMessage({ role: 'notice', content: `Kept ${kept.join(', ')} — edited after the plan ran, so Undo left it in place.` }))
    })
  }, [add, batch, setPlan])

  const apply = useCallback((messageId: string) => {
    const plan = pendingPlan(messageId)
    if (!plan) return
    const chosen = plan.actions.filter((a) => a.resolved && plan.selected.includes(a.id))
    if (!chosen.length) return
    applying.current.add(messageId)
    void applyGlobalPlan(chosen, storeWriter)
      .then((result) => {
        setPlan(messageId, (p) => ({
          ...p, state: 'applied', appliedCount: result.applied, skipped: result.skipped, undoable: result.applied > 0,
        }))
        if (!result.applied) {
          add(newMessage({ role: 'notice', content: 'Nothing was applied — your vault changed since this plan was made.' }))
          return
        }
        batch.register(messageId, {
          target: targetText(result.touched), applied: result.applied,
          revert: async () => (await revertGlobalPlan(result.undo, storeWriter)).kept,
          onUndo: () => undo(messageId),
          onExpire: () => setPlan(messageId, (p) => ({ ...p, undoable: false })),
        })
      })
      .catch((err) => {
        // Some writes may have happened: don't offer Apply again, which could repeat them.
        setPlan(messageId, (p) => ({ ...p, state: 'applied', appliedCount: 0, undoable: false }))
        add(newMessage({ role: 'error', content: `Applying stopped part-way: ${err instanceof Error ? err.message : String(err)}. Check the boards and notes it names.` }))
      })
      .finally(() => applying.current.delete(messageId))
  }, [add, batch, pendingPlan, setPlan, undo])

  return { toggle, apply, cancel, undo }
}
