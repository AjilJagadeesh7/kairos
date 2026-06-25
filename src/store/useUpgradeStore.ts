import { create } from 'zustand'
import type { UpgradeReason } from '../types'

interface UpgradeState {
  /** The reason for the currently-open upgrade modal, or null when closed. */
  activeReason: UpgradeReason | null
  /** Reasons already surfaced this session — used to avoid nagging. */
  shownThisSession: Set<UpgradeReason>
  /** Open the upgrade modal for `reason`, at most once per reason per session. */
  trigger: (reason: UpgradeReason) => void
  dismiss: () => void
}

export const useUpgradeStore = create<UpgradeState>((set, get) => ({
  activeReason: null,
  shownThisSession: new Set(),
  trigger: (reason) => {
    if (get().shownThisSession.has(reason)) return
    set((s) => ({
      activeReason: reason,
      shownThisSession: new Set(s.shownThisSession).add(reason),
    }))
  },
  dismiss: () => set({ activeReason: null }),
}))
