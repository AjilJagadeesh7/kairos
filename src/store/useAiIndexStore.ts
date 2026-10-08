/**
 * Semantic index status for Settings → AI and the global chat. Not persisted:
 * the index itself lives in IndexedDB, and what model built it in useAiStore.
 * Building runs only on an explicit action (PRD), can be paused, and resumes
 * where it stopped (unchanged notes are skipped).
 */
import { create } from 'zustand'
import { useAiStore } from './useAiStore'
import { buildIndex } from '../ai/index/buildIndex'
import { vaultDocs } from '../ai/index/indexDocs'
import { clearIndex, dexieIndexStorage, indexStats, ON_DEVICE_MODEL } from '../ai/index/indexStorage'
import { ensureVaultLoaded, vaultSnapshot } from '../ai/index/vault'

type Status = 'idle' | 'building' | 'paused' | 'error'

interface IndexState {
  status: Status
  progress: { done: number; total: number } | null
  error: string | null
  stats: { chunks: number; docs: number; bytes: number } | null

  /** Builds (or resumes) the whole index. */
  build: () => Promise<void>
  pause: () => void
  /** Re-embeds just these documents (docKeys) — used after a note is saved. */
  update: (keys: Set<string>) => Promise<void>
  remove: () => Promise<void>
  refreshStats: () => Promise<void>
}

let stopRequested = false

async function embedder() {
  const { embedRaw } = await import('../utils/embeddingClient')
  let n = 0
  return (text: string) => embedRaw(`ai-index-${n++}`, text)
}

export const useAiIndexStore = create<IndexState>()((set, get) => ({
  status: 'idle',
  progress: null,
  error: null,
  stats: null,

  build: async () => {
    if (get().status === 'building') return
    stopRequested = false
    set({ status: 'building', error: null, progress: { done: 0, total: 0 } })
    try {
      await ensureVaultLoaded()
      const result = await buildIndex({
        docs: vaultDocs(vaultSnapshot()),
        storage: dexieIndexStorage,
        embed: await embedder(),
        modelId: ON_DEVICE_MODEL,
        onProgress: (progress) => set({ progress }),
        shouldStop: () => stopRequested,
      })
      if (result.stopped) set({ status: 'paused' })
      else {
        useAiStore.getState().setIndexMeta({ modelId: ON_DEVICE_MODEL, builtAt: new Date().toISOString() })
        set({ status: 'idle', progress: null })
      }
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
    await get().refreshStats()
  },

  pause: () => { stopRequested = true },

  update: async (keys) => {
    const meta = useAiStore.getState().indexMeta
    if (!meta || get().status === 'building' || useAiStore.getState().indexSource !== 'on-device') return
    try {
      await buildIndex({
        docs: vaultDocs(vaultSnapshot()),
        storage: dexieIndexStorage,
        embed: await embedder(),
        modelId: ON_DEVICE_MODEL,
        only: keys,
      })
    } catch (err) {
      console.warn('[ai] index update failed:', err)
    }
  },

  remove: async () => {
    stopRequested = true
    await clearIndex()
    useAiStore.getState().setIndexMeta(null)
    set({ status: 'idle', progress: null, error: null })
    await get().refreshStats()
  },

  refreshStats: async () => {
    const s = await indexStats()
    set({ stats: { chunks: s.chunks, docs: s.docs, bytes: s.bytes } })
  },
}))
