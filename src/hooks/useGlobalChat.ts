import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAiStore } from '../store/useAiStore'
import { useAiWebStore } from '../store/useAiWebStore'
import { useBubbleSession } from './useBubbleSession'
import { useGlobalPlan } from './useGlobalPlan'
import { retrieve } from '../ai/index/retrieve'
import { loadIndexedChunks } from '../ai/index/indexStorage'
import { activeEmbedder, activeModelId } from '../ai/index/embedSource'
import { ensureVaultLoaded, vaultSnapshot } from '../ai/index/vault'
import { runGlobalMessage, runPending, runReview } from '../ai/agent/globalActions'
import type { AiChatRecord, BubbleBaseEnv, GlobalEnv, PendingWebRequest, RetrieveFilter, ReviewPeriod, WebRequest } from '../types'

/** Hybrid when the index was built with the current embedding source; keyword otherwise. */
async function retrieveForChat(query: string, filter: RetrieveFilter) {
  const { indexMeta } = useAiStore.getState()
  const modelId = activeModelId()
  const semantic = !!modelId && indexMeta?.modelId === modelId
  return retrieve(query, filter, {
    vault: vaultSnapshot(),
    indexed: semantic ? loadIndexedChunks : null,
    embedQuery: semantic
      ? async (q) => {
          // The embedder failing here degrades the answer to keyword search instead of failing it.
          try {
            return (await activeEmbedder())?.embedQuery(q) ?? null
          } catch (err) {
            console.warn('[ai] query embedding failed, using keyword search:', err)
            return null
          }
        }
      : null,
    modelId,
  })
}

/**
 * One global chat thread: pending items, reviews and questions answered from
 * notes, with source chips (P4), and change requests proposed as plans the
 * user applies (P5). Saved after every turn.
 */
export function useGlobalChat(initial: AiChatRecord, onSaved?: (record: AiChatRecord) => void) {
  const session = useBubbleSession<GlobalEnv>(useMemo(() => ({
    surface: 'global' as const,
    initial,
    source: () => null,
    extendEnv: (base: BubbleBaseEnv): GlobalEnv => ({
      ...base, vault: vaultSnapshot, now: () => new Date(), retrieve: retrieveForChat, web: null,
    }),
    onSaved,
  }), [initial, onSaved]))

  // Web requests wait here for approval when "Ask before each request" is on.
  const [pendingWeb, setPendingWeb] = useState<PendingWebRequest | null>(null)
  const pendingRef = useRef<PendingWebRequest | null>(null)
  useEffect(() => { pendingRef.current = pendingWeb }, [pendingWeb])
  // Leaving the chat declines anything still waiting.
  useEffect(() => () => pendingRef.current?.answer(false), [])
  const confirmWeb = useCallback((request: WebRequest) => new Promise<boolean>((resolve) => {
    const entry: PendingWebRequest = { request, answer: (allow) => { pendingRef.current = null; setPendingWeb(null); resolve(allow) } }
    pendingRef.current = entry
    setPendingWeb(entry)
  }), [])

  // Facts count everything, so the lazily-loaded stores must be in first.
  const send = (text: string) => session.run(text, async (env) => {
    await ensureVaultLoaded()
    // Web code loads only when web access is on; otherwise env.web stays null and no web request can happen.
    if (useAiWebStore.getState().enabled) {
      const { webAccessFor } = await import('../ai/web/webSetup')
      env.web = await webAccessFor(confirmWeb)
    }
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

  const planHandlers = useGlobalPlan({ messagesRef: session.messagesRef, add: session.add, patch: session.patch })

  const stop = () => {
    pendingRef.current?.answer(false)
    session.stop()
  }

  return { ...session, stop, send, pending, review, planHandlers, pendingWeb }
}
