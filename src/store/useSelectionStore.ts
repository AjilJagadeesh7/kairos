import { create } from 'zustand'
import type { SelectionScope } from '../types'

/**
 * Ephemeral multi-select state for the list sidebars (notes, canvas,
 * attachments). Deliberately not persisted: a selection is a transient gesture,
 * and restoring one after a reload would let a bulk delete act on rows the user
 * no longer has on screen.
 *
 * Rows subscribe to their own state via `useIsSelected`, so nothing has to be
 * threaded through the recursive folder trees.
 */
type SelectionState = {
  /** Which sidebar is in selection mode, or null when none is. */
  scope: SelectionScope | null
  ids: Set<string>
  /** Every selectable id in display order — the source for select-all and shift-ranges. */
  order: string[]
  /** Last plainly-clicked id; the fixed end of a shift-click range. */
  anchor: string | null

  enter: (scope: SelectionScope, order: string[]) => void
  exit: () => void
  setOrder: (order: string[]) => void
  /** `extend` = shift-click: fill in everything between the anchor and `id`. */
  toggle: (id: string, extend?: boolean) => void
  selectAll: () => void
  clear: () => void
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  scope: null,
  ids: new Set(),
  order: [],
  anchor: null,

  enter: (scope, order) => set({ scope, order, ids: new Set(), anchor: null }),

  exit: () => set({ scope: null, ids: new Set(), order: [], anchor: null }),

  setOrder: (order) => set({ order }),

  toggle: (id, extend = false) => set((s) => {
    const ids = new Set(s.ids)

    if (extend && s.anchor && s.anchor !== id) {
      const from = s.order.indexOf(s.anchor)
      const to   = s.order.indexOf(id)
      if (from >= 0 && to >= 0) {
        const [lo, hi] = from <= to ? [from, to] : [to, from]
        for (let i = lo; i <= hi; i++) ids.add(s.order[i])
        // Anchor stays put so the range can be re-stretched from the same end.
        return { ids }
      }
    }

    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
    return { ids, anchor: id }
  }),

  selectAll: () => set((s) => ({ ids: new Set(s.order), anchor: null })),

  clear: () => set({ ids: new Set(), anchor: null }),
}))

/** True while `scope` owns selection mode. */
export function useIsSelecting(scope: SelectionScope): boolean {
  return useSelectionStore((s) => s.scope === scope)
}

/** Per-row subscription — only re-renders the row whose state changed. */
export function useIsSelected(scope: SelectionScope, id: string): boolean {
  return useSelectionStore((s) => s.scope === scope && s.ids.has(id))
}

/** Leave selection mode if `scope` still owns it (used on sidebar unmount). */
export function exitSelection(scope: SelectionScope): void {
  const { scope: current, exit } = useSelectionStore.getState()
  if (current === scope) exit()
}
