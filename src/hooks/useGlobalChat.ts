import { useMemo } from 'react'
import { useAiStore } from '../store/useAiStore'
import { useBubbleSession } from './useBubbleSession'
import { retrieve } from '../ai/index/retrieve'
import { normalize } from '../ai/index/buildIndex'
import { loadIndexedChunks, ON_DEVICE_MODEL } from '../ai/index/indexStorage'
import { ensureVaultLoaded, vaultSnapshot } from '../ai/index/vault'
import { runGlobalMessage, runPending, runReview } from '../ai/agent/globalActions'
import type { AiChatRecord, BubbleBaseEnv, GlobalEnv, RetrieveFilter, ReviewPeriod } from '../types'

/** Hybrid when the on-device index is built with the current model; keyword otherwise. */
async function retrieveForChat(query: string, filter: RetrieveFilter) {
  const { indexSource, indexMeta } = useAiStore.getState()
  const semantic = indexSource === 'on-device' && indexMeta?.modelId === ON_DEVICE_MODEL
  return retrieve(query, filter, {
    vault: vaultSnapshot(),
    indexed: semantic ? loadIndexedChunks : null,
    embedQuery: semantic
      ? async (q) => {
          // The model failing here degrades the answer to keyword search instead of failing it.
          try {
            const { embedRaw } = await import('../utils/embeddingClient')
            const v = await embedRaw('chat-query', q)
            return v.length ? normalize(v) : null
          } catch (err) {
            console.warn('[ai] query embedding failed, using keyword search:', err)
            return null
          }
        }
      : null,
    modelId: ON_DEVICE_MODEL,
  })
}

/**
 * One global chat thread. Read-only over the vault (P4): pending items,
 * reviews and questions answered from notes, with source chips. Saved after
 * every turn.
 */
export function useGlobalChat(initial: AiChatRecord, onSaved?: (record: AiChatRecord) => void) {
  const session = useBubbleSession<GlobalEnv>(useMemo(() => ({
    surface: 'global' as const,
    initial,
    source: () => null,
    extendEnv: (base: BubbleBaseEnv): GlobalEnv => ({
      ...base, vault: vaultSnapshot, now: () => new Date(), retrieve: retrieveForChat,
    }),
    onSaved,
  }), [initial, onSaved]))

  // Facts count everything, so the lazily-loaded stores must be in first.
  const send = (text: string) => session.run(text, async (env) => {
    await ensureVaultLoaded()
    await runGlobalMessage(env, text)
  })
  const pending = () => session.run("What's pending this week?", async (env) => {
    await ensureVaultLoaded()
    await runPending(env)
  })
  const review = (period: ReviewPeriod, label: string) => session.run(label, async (env) => {
    await ensureVaultLoaded()
    await runReview(env, period, label)
  })

  return { ...session, send, pending, review }
}
