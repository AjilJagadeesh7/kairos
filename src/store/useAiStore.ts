/**
 * AI assistant settings. Device-local (localStorage) and never synced or
 * written to the vault. API keys are NOT here — they live in OS secure storage
 * (see src/secrets/secureStore.ts).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { AiProviderConfig, AiSurface, ChatRetention, IndexSource } from '../types'

/** Consent is per provider *and* destination: pointing a provider at a
 *  different host asks again. */
export function consentKey(cfg: Pick<AiProviderConfig, 'id' | 'baseUrl'>): string {
  let origin = cfg.baseUrl
  try { origin = new URL(cfg.baseUrl).origin } catch { /* keep raw */ }
  return `${cfg.id}|${origin}`
}

export type NewAiProvider = Omit<AiProviderConfig, 'id' | 'verified' | 'createdAt'>

interface AiState {
  /** Master toggle — off by default. */
  enabled: boolean
  providers: AiProviderConfig[]
  surfaceProvider: Record<AiSurface, string | null>
  /** consentKey → ISO time the cloud consent dialog was accepted. */
  consents: Record<string, string>
  /** Board + column last picked for "Turn this into tasks". */
  taskTarget: { boardId: string; columnId: string } | null
  /** Where the global chat's semantic search gets vectors from. */
  indexSource: IndexSource
  /** The built index: which embedding model made it (a different one needs a rebuild). */
  indexMeta: { modelId: string; builtAt: string } | null
  chatRetention: ChatRetention

  setEnabled: (enabled: boolean) => void
  /** `id` lets the editor pre-allocate one (consent is recorded per id before saving). */
  addProvider: (p: NewAiProvider, id?: string) => string
  updateProvider: (id: string, patch: Partial<NewAiProvider>) => void
  removeProvider: (id: string) => void
  markVerified: (id: string, verified: boolean) => void
  setSurfaceProvider: (surface: AiSurface, providerId: string | null) => void
  grantConsent: (cfg: AiProviderConfig) => void
  setTaskTarget: (target: { boardId: string; columnId: string }) => void
  setIndexSource: (source: IndexSource) => void
  setIndexMeta: (meta: { modelId: string; builtAt: string } | null) => void
  setChatRetention: (retention: ChatRetention) => void
}

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      enabled: false,
      providers: [],
      surfaceProvider: { global: null, bubble: null },
      consents: {},
      taskTarget: null,
      indexSource: 'on-device',
      indexMeta: null,
      chatRetention: 'keep',

      setEnabled: (enabled) => set({ enabled }),

      addProvider: (p, id = uuid()) => {
        set((s) => ({ providers: [...s.providers, { ...p, id, verified: false, createdAt: new Date().toISOString() }] }))
        return id
      },

      updateProvider: (id, patch) => set((s) => {
        const current = s.providers.find((p) => p.id === id)
        if (!current) return s
        // A changed destination or model must pass Test connection again.
        const reverify = destinationChanged(current, patch)
        return {
          providers: s.providers.map((p) => (p.id === id ? { ...p, ...patch, verified: reverify ? false : p.verified } : p)),
          surfaceProvider: reverify ? unselect(s.surfaceProvider, id) : s.surfaceProvider,
        }
      }),

      removeProvider: (id) => set((s) => ({
        providers: s.providers.filter((p) => p.id !== id),
        surfaceProvider: unselect(s.surfaceProvider, id),
        consents: Object.fromEntries(Object.entries(s.consents).filter(([k]) => !k.startsWith(`${id}|`))),
      })),

      markVerified: (id, verified) => set((s) => ({
        providers: s.providers.map((p) => (p.id === id ? { ...p, verified } : p)),
        surfaceProvider: verified ? s.surfaceProvider : unselect(s.surfaceProvider, id),
      })),

      setSurfaceProvider: (surface, providerId) => set((s) => {
        // Test connection must pass before a provider can be selected (PRD).
        if (providerId && !s.providers.find((p) => p.id === providerId)?.verified) return s
        return { surfaceProvider: { ...s.surfaceProvider, [surface]: providerId } }
      }),

      grantConsent: (cfg) => set((s) => ({ consents: { ...s.consents, [consentKey(cfg)]: new Date().toISOString() } })),

      setTaskTarget: (taskTarget) => set({ taskTarget }),
      setIndexSource: (indexSource) => set({ indexSource }),
      setIndexMeta: (indexMeta) => set({ indexMeta }),
      setChatRetention: (chatRetention) => set({ chatRetention }),
    }),
    { name: 'kairos-ai' },
  ),
)

function destinationChanged(p: AiProviderConfig, patch: Partial<NewAiProvider>): boolean {
  return (patch.baseUrl !== undefined && patch.baseUrl !== p.baseUrl)
    || (patch.model !== undefined && patch.model !== p.model)
    || (patch.type !== undefined && patch.type !== p.type)
}

function unselect(current: Record<AiSurface, string | null>, id: string): Record<AiSurface, string | null> {
  return {
    global: current.global === id ? null : current.global,
    bubble: current.bubble === id ? null : current.bubble,
  }
}
