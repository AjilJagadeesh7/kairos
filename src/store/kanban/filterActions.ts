import { DEFAULT_FILTERS, fsUpsertBoard, type SetFn, type GetFn } from './helpers'
import type { KanbanFilters } from '../../types/kanban.types'

export function makeFilterActions(set: SetFn, get: GetFn) {
  return {
    setFilters: (filters: Partial<KanbanFilters>) =>
      set(s => ({ filters: { ...s.filters, ...filters } })),

    clearFilters: () => set({ filters: DEFAULT_FILTERS }),

    undo: (boardId: string) => {
      const { boards, history } = get()
      const bh = history[boardId]
      if (!bh || bh.past.length === 0) return
      const prev    = bh.past[bh.past.length - 1]
      const current = boards.find(b => b.id === boardId)!
      set({
        boards:  boards.map(b => (b.id === boardId ? prev : b)),
        history: { ...history, [boardId]: { past: bh.past.slice(0, -1), future: [current, ...bh.future] } },
      })
      void fsUpsertBoard(prev)
    },

    redo: (boardId: string) => {
      const { boards, history } = get()
      const bh = history[boardId]
      if (!bh || bh.future.length === 0) return
      const next    = bh.future[0]
      const current = boards.find(b => b.id === boardId)!
      set({
        boards:  boards.map(b => (b.id === boardId ? next : b)),
        history: { ...history, [boardId]: { past: [...bh.past, current], future: bh.future.slice(1) } },
      })
      void fsUpsertBoard(next)
    },
  }
}
