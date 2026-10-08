import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useKanbanStore } from '../store/useKanbanStore'
import { revertPlan } from '../ai/agent/boardApply'
import type { BatchUndo } from '../types'

/** How long Undo stays available after Apply (PRD). */
export const UNDO_WINDOW_MS = 10_000

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * The 10-second Undo window after an AI plan is applied to a board: a toast
 * with Undo, and a timer that closes the window. Undo reverts the whole batch
 * as one write.
 */
export function useBatchUndo() {
  const batches = useRef(new Map<string, { boardId: string; undo: BatchUndo }>())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const live = timers.current
    return () => { for (const t of live) clearTimeout(t) }
  }, [])

  /** Reverts batch `key`; returns the keys of created cards kept because the user edited them, or null when there's nothing to undo. */
  const undo = useCallback((key: string): string[] | null => {
    const entry = batches.current.get(key)
    const board = entry && useKanbanStore.getState().boards.find((b) => b.id === entry.boardId)
    if (!entry || !board) return null
    batches.current.delete(key)
    const { board: reverted, kept } = revertPlan(board, entry.undo)
    useKanbanStore.getState().commitBatch(entry.boardId, () => reverted)
    return kept
  }, [])

  /** Opens the Undo window for an applied batch. `onUndo` runs the toast's Undo; `onExpire` when the window closes. */
  const register = useCallback((key: string, opts: {
    boardId: string; boardTitle: string; applied: number; undo: BatchUndo; onUndo: () => void; onExpire: () => void
  }) => {
    batches.current.set(key, { boardId: opts.boardId, undo: opts.undo })
    toast.success(`Applied ${plural(opts.applied, 'change')} to ${opts.boardTitle}`, {
      duration: UNDO_WINDOW_MS,
      // Top: the default bottom-right slot would cover the bubble's composer.
      position: 'top-center',
      action: { label: 'Undo', onClick: opts.onUndo },
    })
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      batches.current.delete(key)
      opts.onExpire()
    }, UNDO_WINDOW_MS)
    timers.current.add(timer)
  }, [])

  return { register, undo }
}
