import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useAiStore } from '../store/useAiStore'
import { providerForSurface } from '../ai/providers/registry'
import { locationForUrl } from '../ai/net/urlPolicy'
import { promptBudget } from '../ai/agent/budget'
import { StoppedError } from '../ai/agent/condense'
import { newMessage } from '../ai/agent/bubbleEnv'
import { bubbleChatRecord, saveChat } from '../ai/history/chatHistory'
import { useBubbleSuggestions } from './useBubbleSuggestions'
import type {
  AiChatRecord, BubbleMessage, BubbleRun, Condensed, LLMProvider, Msg, UseNoteBubbleParams,
} from '../types'

/** Earlier turns for follow-up questions: what was said, not the suggestion UI. */
function historyOf(messages: BubbleMessage[]): Msg[] {
  return messages
    .filter((m) => (m.role === 'user' || (m.role === 'assistant' && !m.suggestion)) && m.content.trim())
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
}

/**
 * One ephemeral bubble session on a note. Every mount starts empty; closing
 * (unmount) or clearing saves the conversation to chat history.
 */
export function useNoteBubble(params: UseNoteBubbleParams) {
  const config = useAiStore((s) => s.providers.find((p) => p.id === s.surfaceProvider.bubble) ?? null)
  const [messages, setMessages] = useState<BubbleMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  const paramsRef = useRef(params)
  const messagesRef = useRef(messages)
  useEffect(() => { paramsRef.current = params }, [params])
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

  /** A new action replaces any suggestion still waiting in the editor. */
  const supersedePending = useCallback(() => {
    paramsRef.current.bridge.clearPreview()
    setMessages((ms) => ms.map((m) => {
      const s = m.suggestion
      return (s?.kind === 'replace' || s?.kind === 'insert') && s.state === 'pending'
        ? { ...m, suggestion: { ...s, state: 'rejected' } }
        : m
    }))
  }, [])

  const run: BubbleRun = useCallback(async (userText, job) => {
    if (busyRef.current) return
    const history = historyOf(messagesRef.current)
    supersedePending()
    if (userText) add(newMessage({ role: 'user', content: userText }))
    busyRef.current = true
    stopRequested.current = false
    setBusy(true)
    try {
      const { provider, config: cfg } = await providerForSurface('bubble')
      active.current = provider
      providerInfo.current = { id: cfg.id, name: cfg.name, model: cfg.model, location: locationForUrl(cfg.baseUrl) }
      const p = paramsRef.current
      await job({
        provider,
        budget: promptBudget(cfg),
        note: p.note,
        vocabulary: p.vocabulary(),
        bridge: p.bridge,
        sink: { add, patch, progress: setProgress },
        isStopped: () => stopRequested.current,
        history: () => history,
        cache: cache.current,
      })
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
  }, [add, patch, supersedePending])

  const suggestions = useBubbleSuggestions({ paramsRef, messagesRef, add, patch, run })

  const stop = useCallback(() => {
    stopRequested.current = true
    active.current?.abort()
  }, [])

  /** Saves the session to chat history (no-op when nothing was asked). */
  const persist = useCallback(() => {
    const note = paramsRef.current.note()
    const record = bubbleChatRecord({
      id: session.current.id,
      source: { kind: 'note', id: note.id, title: note.title },
      provider: providerInfo.current,
      messages: messagesRef.current,
      createdAt: session.current.createdAt,
    })
    if (record) saveChat(record).catch((err) => console.warn('[ai] could not save bubble chat:', err))
  }, [])

  const clear = useCallback(() => {
    stop()
    paramsRef.current.bridge.clearPreview()
    persist()
    session.current = { id: uuid(), createdAt: new Date().toISOString() }
    cache.current.clear()
    setMessages([])
  }, [persist, stop])

  // Closing the bubble (or leaving the note) ends the session.
  useEffect(() => () => {
    stopRequested.current = true
    active.current?.abort()
    paramsRef.current.bridge.clearPreview()
    persist()
  }, [persist])

  return { config, messages, busy, progress, run, stop, clear, ...suggestions }
}
