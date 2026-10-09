import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useKanbanStore } from '../store/useKanbanStore'
import { revertPlan } from '../ai/agent/boardApply'
import type { BatchUndo } from '../types'

/** How long Undo stays available after Apply (PRD). */
export const UNDO_WINDOW_MS = 10_000

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Reverts one board batch as a single write; returns the keys of created cards kept because the user edited them. */
export function boardRevert(boardId: string, undo: BatchUndo): () => Promise<string[] | null> {
  return async () => {
    const board = useKanbanStore.getState().boards.find((b) => b.id === boardId)
    if (!board) return null
    const { board: reverted, kept } = revertPlan(board, undo)
    useKanbanStore.getState().commitBatch(boardId, () => reverted)
    return kept
  }
}

/**
 * The 10-second Undo window after an AI plan is applied: a toast with Undo,
 * and a timer that closes the window. Undo reverts the whole batch.
 */
export function useBatchUndo() {
  const batches = useRef(new Map<string, () => Promise<string[] | null>>())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const live = timers.current
    return () => { for (const t of live) clearTimeout(t) }
  }, [])

  /** Reverts batch `key`; returns what was kept because the user edited it since, or null when there's nothing to undo. */
  const undo = useCallback(async (key: string): Promise<string[] | null> => {
    const revert = batches.current.get(key)
    if (!revert) return null
    batches.current.delete(key)
    return revert()
  }, [])

  /** Opens the Undo window for an applied batch. `onUndo` runs the toast's Undo; `onExpire` when the window closes. */
  const register = useCallback((key: string, opts: {
    /** What was changed, e.g. "Sprint board" or "Sprint board and 1 note". */
    target: string; applied: number; revert: () => Promise<string[] | null>; onUndo: () => void; onExpire: () => void
  }) => {
    batches.current.set(key, opts.revert)
    toast.success(`Applied ${plural(opts.applied, 'change')} to ${opts.target}`, {
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
