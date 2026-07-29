import { create } from 'zustand'
import { toast } from 'sonner'
import {
  listTrash,
  purgeTrashItems,
  emptyTrash as svcEmptyTrash,
  TRASH_CHANGED_EVENT,
} from '../trash/trashService'
import type { TrashItem } from '../types'

type TrashState = {
  items: TrashItem[]
  isLoaded: boolean
  /** Ids currently being restored — used to disable their row buttons. */
  busyIds: string[]

  loadTrash: () => Promise<void>
  restore: (id: string) => Promise<void>
  purge: (id: string) => Promise<void>
  purgeMany: (ids: string[]) => Promise<void>
  emptyAll: () => Promise<void>
}

export const useTrashStore = create<TrashState>()((set, get) => ({
  items: [],
  isLoaded: false,
  busyIds: [],

  loadTrash: async () => {
    set({ items: await listTrash(), isLoaded: true })
  },

  restore: async (id) => {
    const item = get().items.find(i => i.id === id)
    if (!item || get().busyIds.includes(id)) return

    set(s => ({ busyIds: [...s.busyIds, id] }))
    try {
      const { restoreTrashItem } = await import('../trash/trashRestore')
      await restoreTrashItem(item)
      // Only drop the trash record once the item is safely back.
      await purgeTrashItems([id])
      toast.success(`Restored "${item.title}"`)
    } catch (err) {
      console.warn('[trash] restore failed:', err)
      toast.error(`Could not restore "${item.title}"`)
    } finally {
      set(s => ({ busyIds: s.busyIds.filter(b => b !== id) }))
      await get().loadTrash()
    }
  },

  purge: async (id) => {
    await purgeTrashItems([id])
    await get().loadTrash()
  },

  purgeMany: async (ids) => {
    await purgeTrashItems(ids)
    await get().loadTrash()
  },

  emptyAll: async () => {
    await svcEmptyTrash()
    await get().loadTrash()
  },
}))

// Keep an open Trash page in step with deletes happening elsewhere in the app.
if (typeof window !== 'undefined') {
  window.addEventListener(TRASH_CHANGED_EVENT, () => {
    if (useTrashStore.getState().isLoaded) void useTrashStore.getState().loadTrash()
  })
}
