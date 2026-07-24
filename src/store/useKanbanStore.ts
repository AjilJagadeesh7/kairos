import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useLoaderStore } from './useLoaderStore'
import { normalizeBoard, DEFAULT_FILTERS, type KanbanState } from './kanban/helpers'
import { makeBoardActions } from './kanban/boardActions'
import { makeTaskActions } from './kanban/taskActions'
import { makeMetaActions } from './kanban/metaActions'
import { makeFilterActions } from './kanban/filterActions'
import { makeSprintActions } from './kanban/sprintActions'

export { DEFAULT_FILTERS } from './kanban/helpers'
export type { KanbanState } from './kanban/helpers'

export const useKanbanStore = create<KanbanState>()(
  persist(
    (set, get) => ({
      boards: [],
      activeBoardId: null,
      activeTaskId: null,
      isLoaded: false,
      filters: DEFAULT_FILTERS,
      groupBy: 'none',
      history: {},

      loadBoards: async () => {
        const { readAllBoards, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (!isPlainFolderConnected()) { set({ isLoaded: true }); return }
        await useLoaderStore.getState().run('load-boards', async () => {
          try {
            const boards = (await readAllBoards()).map(normalizeBoard)
            boards.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            set({ boards, isLoaded: true })
          } catch (err) {
            console.warn('[kanban] loadBoards failed:', err)
            set({ isLoaded: true })
          }
        })
      },

      setActiveBoardId: (activeBoardId) => set({ activeBoardId }),
      setActiveTaskId:  (activeTaskId)  => set({ activeTaskId }),
      setGroupBy:       (groupBy)       => set({ groupBy }),

      ...makeBoardActions(set, get),
      ...makeTaskActions(set, get),
      ...makeMetaActions(set, get),
      ...makeFilterActions(set, get),
      ...makeSprintActions(set, get),
    }),
    {
      name: 'kairos-kanban-ui',
      partialize: (state) => ({
        activeBoardId: state.activeBoardId,
        groupBy:       state.groupBy,
        // Don't persist transient scoping (search + sprint) across launches —
        // a stale sprint scope silently hides issues.
        filters:       { ...state.filters, query: '', sprint: null },
      }),
      // Backfill defaults so filters persisted before newer fields (types/query)
      // existed don't rehydrate with undefined values.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<KanbanState>
        return {
          ...current,
          ...p,
          filters: { ...DEFAULT_FILTERS, ...(p.filters ?? {}) },
        }
      },
    },
  ),
)
