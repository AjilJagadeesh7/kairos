import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useLoaderStore } from './useLoaderStore'
import { normalizeBoard, DEFAULT_FILTERS, type KanbanState } from './kanban/helpers'
import { makeBoardActions } from './kanban/boardActions'
import { makeTaskActions } from './kanban/taskActions'
import { makeMetaActions } from './kanban/metaActions'
import { makeFilterActions } from './kanban/filterActions'

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

      ...makeBoardActions(set, get),
      ...makeTaskActions(set, get),
      ...makeMetaActions(set, get),
      ...makeFilterActions(set, get),
    }),
    {
      name: 'mindvault-kanban-ui',
      partialize: (state) => ({
        activeBoardId: state.activeBoardId,
        filters:       state.filters,
      }),
    },
  ),
)
