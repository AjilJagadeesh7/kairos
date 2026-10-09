/**
 * Web access settings (P7). Device-local and never synced. Off by default;
 * it can be turned on only once Test connection passed for the current
 * provider, and changing the provider or its URL/key turns it off again.
 * The Brave API key lives in secure storage, not here.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WebSettings } from '../types'

export const DEFAULT_WEB_SETTINGS: WebSettings = {
  enabled: false,
  provider: 'searxng',
  searxngUrl: '',
  askBeforeEach: true,
  allowlist: [],
  blocklist: [],
  maxResults: 5,
  maxPageBytes: 1_000_000,
  verified: null,
}

/** What Test connection exercised; a different signature needs a new test. */
export function webSignature(s: Pick<WebSettings, 'provider' | 'searxngUrl'>, hasBraveKey: boolean): string {
  const url = s.provider === 'searxng' ? s.searxngUrl.trim().replace(/\/+$/, '') : ''
  return `${s.provider}|${url}|${s.provider === 'brave' && hasBraveKey ? 'key' : ''}`
}

interface WebState extends WebSettings {
  update: (patch: Partial<Omit<WebSettings, 'enabled' | 'verified'>>) => void
  markVerified: (signature: string | null) => void
  setEnabled: (enabled: boolean) => void
}

export const useAiWebStore = create<WebState>()(
  persist(
    (set) => ({
      ...DEFAULT_WEB_SETTINGS,
      update: (patch) => set((s) => {
        const destination = (patch.provider !== undefined && patch.provider !== s.provider)
          || (patch.searxngUrl !== undefined && patch.searxngUrl.trim() !== s.searxngUrl.trim())
        return destination ? { ...patch, verified: null, enabled: false } : patch
      }),
      markVerified: (verified) => set(verified ? { verified } : { verified: null, enabled: false }),
      // Test connection must pass first (PRD).
      setEnabled: (enabled) => set((s) => (enabled && !s.verified ? s : { enabled })),
    }),
    { name: 'kairos-ai-web' },
  ),
)
