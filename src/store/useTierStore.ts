import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { KairosTier } from '../types'

interface TierState {
  tier: KairosTier
  setTier: (tier: KairosTier) => void
}

/**
 * Local app-config storage for the current tier. This is the dev/local stand-in
 * for a subscription source — when hosted sync ships, the tier will come from a
 * server JWT and only src/tiers/tierProvider.ts needs to change.
 */
export const useTierStore = create<TierState>()(
  persist(
    (set) => ({
      tier: 'free',
      setTier: (tier) => set({ tier }),
    }),
    { name: 'kairos_tier' },
  ),
)

/** React hook: the current tier (re-renders on change). */
export function useTier(): KairosTier {
  return useTierStore((s) => s.tier)
}
