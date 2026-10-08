import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useAiStore } from '../store/useAiStore'
import { providerForSurface } from '../ai/providers/registry'
import { locationForUrl } from '../ai/net/urlPolicy'
import { promptBudget } from '../ai/agent/budget'
import { StoppedError } from '../ai/agent/condense'
import { newMessage } from '../ai/agent/bubbleEnv'
import { bubbleChatRecord, saveChat } from '../ai/history/chatHistory'
import type {
  AiChatRecord, AiChatSource, BubbleBaseEnv, BubbleMessage, BubbleRun, BubbleSink, Condensed, LLMProvider, Msg,
} from '../types'

/** Earlier turns for follow-up questions: what was said, not the suggestion/plan UI. */
function historyOf(messages: BubbleMessage[]): Msg[] {
  return messages
    .filter((m) => (m.role === 'user' || (m.role === 'assistant' && !m.suggestion && !m.plan)) && m.content.trim())
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
}

export interface BubbleSessionOptions<E extends BubbleBaseEnv> {
  /** The page this session runs on, for chat history. */
  source: () => AiChatSource
  /** Adds the page-specific parts to the env each action gets. */
  extendEnv: (base: BubbleBaseEnv) => E
  /** Runs before every action (e.g. retire a suggestion still showing). */
  beforeRun?: (session: { messages: BubbleMessage[]; patch: BubbleSink['patch'] }) => void
  /** Runs when the session ends: clear, close, or leaving the page. */
  onEnd?: () => void
}

/**
 * One ephemeral bubble session on any page. Every mount starts empty;
 * closing (unmount) or clearing saves the conversation to chat history.
 */
export function useBubbleSession<E extends BubbleBaseEnv>(options: BubbleSessionOptions<E>) {
  const config = useAiStore((s) => s.providers.find((p) => p.id === s.surfaceProvider.bubble) ?? null)
  const [messages, setMessages] = useState<BubbleMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  const optionsRef = useRef(options)
  const messagesRef = useRef(messages)
  useEffect(() => { optionsRef.current = options }, [options])
  useEffect(() => { messagesRef.current = messages }, [messages])

  const busyRef = useRef(false)
  const stopRequested = useRef(false)
  const active = useRef<LLMProvider | null>(null)
  const cache = useRef(new Map<string, Condensed>())
  const session = useRef({ id: uuid(), createdAt: new Date().toISOString() })
  const providerInfo = useRef<AiChatRecord['provider']>(null)

  const add = useCallback((m: BubbleMessage) => setMessages((ms) => [...ms, m]), [])
  const patch = useCallback((id: string, update: (m: BubbleMessage) => BubbleMessage) =>
    setMessages((ms) => ms.map((m) => (m.id === id ? update(m) : m))), [])

  const run: BubbleRun<E> = useCallback(async (userText, job) => {
    if (busyRef.current) return
    const history = historyOf(messagesRef.current)
    optionsRef.current.beforeRun?.({ messages: messagesRef.current, patch })
    if (userText) add(newMessage({ role: 'user', content: userText }))
    busyRef.current = true
    stopRequested.current = false
    setBusy(true)
    try {
      const { provider, config: cfg } = await providerForSurface('bubble')
      active.current = provider
      providerInfo.current = { id: cfg.id, name: cfg.name, model: cfg.model, location: locationForUrl(cfg.baseUrl) }
      await job(optionsRef.current.extendEnv({
        provider,
        budget: promptBudget(cfg),
        sink: { add, patch, progress: setProgress },
        isStopped: () => stopRequested.current,
        history: () => history,
        cache: cache.current,
      }))
    } catch (err) {
      if (err instanceof StoppedError || stopRequested.current) {
        add(newMessage({ role: 'notice', content: 'Stopped.' }))
      } else {
        add(newMessage({ role: 'error', content: err instanceof Error ? err.message : String(err) }))
      }
    } finally {
      active.current = null
      busyRef.current = false
      setBusy(false)
      setProgress(null)
      setMessages((ms) => ms.map((m) => (m.streaming ? { ...m, streaming: false } : m)))
    }
  }, [add, patch])

  const stop = useCallback(() => {
    stopRequested.current = true
    active.current?.abort()
  }, [])

  /** Saves the session to chat history (no-op when nothing was asked). */
  const persist = useCallback(() => {
    const record = bubbleChatRecord({
      id: session.current.id,
      source: optionsRef.current.source(),
      provider: providerInfo.current,
      messages: messagesRef.current,
      createdAt: session.current.createdAt,
    })
    if (record) saveChat(record).catch((err) => console.warn('[ai] could not save bubble chat:', err))
  }, [])

  const clear = useCallback(() => {
    stop()
    optionsRef.current.onEnd?.()
    persist()
    session.current = { id: uuid(), createdAt: new Date().toISOString() }
    cache.current.clear()
    setMessages([])
  }, [persist, stop])

  // Closing the bubble (or leaving the page) ends the session.
  useEffect(() => () => {
    stopRequested.current = true
    active.current?.abort()
    optionsRef.current.onEnd?.()
    persist()
  }, [persist])

  return { config, messages, messagesRef, busy, progress, run, stop, clear, add, patch }
}
