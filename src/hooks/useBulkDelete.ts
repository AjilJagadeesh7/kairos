import { useCallback } from 'react'
import { toast } from 'sonner'
import { useSelectionStore } from '../store/useSelectionStore'
import { useConfirmStore } from '../store/useConfirmStore'
import type { SelectionScope } from '../types'

interface Options {
  scope: SelectionScope
  /** Singular noun for counts, e.g. "note". */
  noun: string
  /** Plural, when adding "s" is wrong — "canvas" → "canvases". */
  plural?: string
  /**
   * Deletes one item. Pass the store's own delete action so the item still goes
   * through its trash capture — bulk delete must stay recoverable like any other
   * delete path (see CLAUDE.md).
   */
  remove: (id: string) => void | Promise<void>
}

/**
 * Confirms, then deletes every selected item in the scope one at a time and
 * leaves selection mode. Sequential rather than parallel so a large selection
 * can't fire hundreds of concurrent vault writes and sync pushes.
 */
export function useBulkDelete({ scope, noun, plural, remove }: Options): () => void {
  return useCallback(() => {
    const { scope: active, ids, exit } = useSelectionStore.getState()
    if (active !== scope || ids.size === 0) return

    const many = plural ?? `${noun}s`
    const count = (n: number) => `${n} ${n === 1 ? noun : many}`

    const targets = [...ids]
    const n = targets.length
    const label = count(n)

    void useConfirmStore.getState()
      .confirm({
        title: `Delete ${label}?`,
        message: 'They move to Trash and can be restored from there.',
        confirmLabel: `Delete ${label}`,
        danger: true,
      })
      .then(async ok => {
        if (!ok) return

        let failed = 0
        for (const id of targets) {
          try {
            await remove(id)
          } catch (err) {
            failed++
            console.warn(`[bulk-delete] ${noun} ${id} failed:`, err)
          }
        }

        exit()

        const done = n - failed
        if (done > 0)   toast.success(`${count(done)} moved to Trash`)
        if (failed > 0) toast.error(`${count(failed)} could not be deleted`)
      })
  }, [scope, noun, plural, remove])
}
