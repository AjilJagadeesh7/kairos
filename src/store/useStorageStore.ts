import { create } from 'zustand'
import { computeStorageUsage } from '../tiers/storageUsage'
import type { StorageUsage } from '../types'

const REFRESH_MS = 5 * 60 * 1000

interface StorageState {
  usage: StorageUsage | null
  lastCalcAt: number | null
  recalculating: boolean
  recalculate: () => Promise<void>
  startAutoRefresh: () => void
}

let intervalId: ReturnType<typeof setInterval> | null = null

export const useStorageStore = create<StorageState>((set, get) => ({
  usage: null,
  lastCalcAt: null,
  recalculating: false,

  recalculate: async () => {
    if (get().recalculating) return
    set({ recalculating: true })
    try {
      const usage = await computeStorageUsage()
      set({ usage, lastCalcAt: Date.now() })
    } catch (err) {
      console.warn('[storage] usage recalc failed:', err)
    } finally {
      set({ recalculating: false })
    }
  },

  startAutoRefresh: () => {
    if (intervalId) return
    void get().recalculate()
    intervalId = setInterval(() => void get().recalculate(), REFRESH_MS)
  },
}))
