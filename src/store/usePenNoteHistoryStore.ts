import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PenNoteVersion, PenStroke } from '../types'

const MAX_VERSIONS = 30

interface PenNoteHistoryState {
  /** Versions per pen note, ordered oldest → newest. */
  byNote: Record<string, PenNoteVersion[]>
  record: (id: string, strokes: PenStroke[]) => void
  list: (id: string) => PenNoteVersion[]
}

// Local history for pen notes (localStorage). When pen notes move into the
// vault (see useCanvasStore pattern), this should follow into vault history
// files so version history syncs across devices like notes/journal.
export const usePenNoteHistoryStore = create<PenNoteHistoryState>()(
  persist(
    (set, get) => ({
      byNote: {},

      record: (id, strokes) => set((s) => {
        const prev = s.byNote[id] ?? []
        const last = prev[prev.length - 1]
        // Skip if nothing changed since the last snapshot.
        if (last && last.strokeCount === strokes.length &&
            JSON.stringify(last.strokes) === JSON.stringify(strokes)) {
          return s
        }
        const version: PenNoteVersion = {
          savedAt: new Date().toISOString(),
          strokeCount: strokes.length,
          strokes,
        }
        const next = [...prev, version].slice(-MAX_VERSIONS)
        return { byNote: { ...s.byNote, [id]: next } }
      }),

      list: (id) => get().byNote[id] ?? [],
    }),
    { name: 'kairos-pennote-history' },
  ),
)
