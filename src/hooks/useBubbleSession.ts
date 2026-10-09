import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useAiStore } from '../store/useAiStore'
import { useOnDeviceStore } from '../store/useOnDeviceStore'
import { ON_DEVICE_PROVIDER_ID, onDeviceConfig } from '../ai/onDevice/onDeviceConfig'
import { providerForSurface } from '../ai/providers/registry'
import { locationForUrl } from '../ai/net/urlPolicy'
import { promptBudget } from '../ai/agent/budget'
import { StoppedError } from '../ai/agent/condense'
import { fitText, newMessage } from '../ai/agent/bubbleEnv'
import { chatRecord, fromChatMessage } from '../ai/history/chatHistory'
import { getChat, saveChat } from '../ai/history/chatStore'
import { ATTACH_SHARE, attachedContextBlock } from '../ai/history/attachContext'
import type {
  AiChatRecord, AiChatSource, AiSurface, BubbleBaseEnv, BubbleMessage, BubbleRun, BubbleSink, Condensed, LLMProvider, Msg,
} from '../types'

/** Earlier turns for follow-up questions: what was said, not the suggestion/plan UI. */
function historyOf(messages: BubbleMessage[]): Msg[] {
  return messages
    .filter((m) => (m.role === 'user' || (m.role === 'assistant' && !m.suggestion && !m.plan && !m.taskPlan && !m.globalPlan)) && m.content.trim())
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
}

export interface BubbleSessionOptions<E extends BubbleBaseEnv> {
  /** Which provider setting to use. Default: the page bubble. */
  surface?: AiSurface
  /** A saved global thread to continue. Bubble sessions always start empty. */
  initial?: AiChatRecord | null
  /** The page this session runs on (bubble), or null (global chat). */
  source: () => AiChatSource | null
  /** Adds the page-specific parts to the env each action gets. */
  extendEnv: (base: BubbleBaseEnv) => E
  /** Runs before every action (e.g. retire a suggestion still showing). */
  beforeRun?: (session: { messages: BubbleMessage[]; patch: BubbleSink['patch'] }) => void
  /** Runs when the session ends: clear, close, or leaving the page. */
  onEnd?: () => void
  /** Called after the session was saved (global threads save after every turn). */
  onSaved?: (record: AiChatRecord) => void
  /** Keeps a fixed title (a bubble chat continued on the chat page) instead of naming it after the first question. */
  title?: string
}

/**
 * One chat session. Bubble sessions are ephemeral: every mount starts empty,
 * and closing or clearing saves them. Global threads save after every turn
 * and can be reopened.
 */
export function useBubbleSession<E extends BubbleBaseEnv>(options: BubbleSessionOptions<E>) {
  const surface = options.surface ?? 'bubble'
  const configured = useAiStore((s) => s.providers.find((p) => p.id === s.surfaceProvider[surface]) ?? null)
  const onDevice = useAiStore((s) => s.surfaceProvider[surface] === ON_DEVICE_PROVIDER_ID)
  const modelId = useOnDeviceStore((s) => s.modelId)
  const readyPath = useOnDeviceStore((s) => s.readyPath)
  const config = useMemo(() => (onDevice ? onDeviceConfig(modelId, readyPath) : configured), [onDevice, modelId, readyPath, configured])
  const [messages, setMessages] = useState<BubbleMessage[]>(() => options.initial?.messages.map(fromChatMessage) ?? [])
  const [attached, setAttached] = useState<string[]>(() => options.initial?.attachedChatIds ?? [])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  const optionsRef = useRef(options)
  const messagesRef = useRef(messages)
  const attachedRef = useRef(attached)
  useEffect(() => { optionsRef.current = options }, [options])
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { attachedRef.current = attached }, [attached])

  const busyRef = useRef(false)
  const saveAfterTurn = useRef(false)
  const stopRequested = useRef(false)
  const active = useRef<LLMProvider | null>(null)
  const cache = useRef(new Map<string, Condensed>())
  const session = useRef({
    id: options.initial?.id ?? uuid(),
    createdAt: options.initial?.createdAt ?? new Date().toISOString(),
  })
  const providerInfo = useRef<AiChatRecord['provider']>(options.initial?.provider ?? null)

  const add = useCallback((m: BubbleMessage) => setMessages((ms) => [...ms, m]), [])
  const patch = useCallback((id: string, update: (m: BubbleMessage) => BubbleMessage) =>
    setMessages((ms) => ms.map((m) => (m.id === id ? update(m) : m))), [])

  const toRecord = useCallback((list: BubbleMessage[]) => chatRecord({
    id: session.current.id,
    surface,
    source: optionsRef.current.source(),
    provider: providerInfo.current,
    messages: list,
    attachedChatIds: attachedRef.current,
    createdAt: session.current.createdAt,
    title: optionsRef.current.title,
  }), [surface])

  /** Saves the session to chat history (no-op when nothing was asked). */
  const persist = useCallback((list: BubbleMessage[] = messagesRef.current) => {
    const record = toRecord(list)
    if (!record) return
    saveChat(record)
      .then(() => optionsRef.current.onSaved?.(record))
      .catch((err) => console.warn('[ai] could not save chat:', err))
  }, [toRecord])

  /** Saves now and returns the chat's id, so the chat page can continue it; null when there's nothing to save or history is off. */
  const saveNow = useCallback(async (): Promise<string | null> => {
    const record = toRecord(messagesRef.current)
    if (!record || useAiStore.getState().chatRetention === 'never') return null
    await saveChat(record)
    return record.id
  }, [toRecord])

  const run: BubbleRun<E> = useCallback(async (userText, job) => {
    if (busyRef.current) return
    const history = historyOf(messagesRef.current)
    optionsRef.current.beforeRun?.({ messages: messagesRef.current, patch })
    if (userText) add(newMessage({ role: 'user', content: userText }))
    busyRef.current = true
    stopRequested.current = false
    setBusy(true)
    try {
      const { provider, config: cfg } = await providerForSurface(surface)
      active.current = provider
      providerInfo.current = { id: cfg.id, name: cfg.name, model: cfg.model, location: locationForUrl(cfg.baseUrl) }
      const base: BubbleBaseEnv = {
        provider,
        budget: promptBudget(cfg),
        sink: { add, patch, progress: setProgress },
        isStopped: () => stopRequested.current,
        history: () => history,
        cache: cache.current,
        attachedContext: async () => {
          const records = (await Promise.all(attachedRef.current.map(getChat))).filter((r): r is AiChatRecord => !!r)
          const share = Math.floor(base.budget * ATTACH_SHARE)
          return attachedContextBlock(records, share, async (title, text, target) => (await fitText(base, title, text, target)).text)
        },
      }
      await job(optionsRef.current.extendEnv(base))
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
      saveAfterTurn.current = surface === 'global'
    }
  }, [add, patch, surface])

  // Global threads persist after every turn (once the final messages have rendered).
  useEffect(() => {
    if (busy || !saveAfterTurn.current) return
    saveAfterTurn.current = false
    persist(messages)
  }, [busy, messages, persist])

  const stop = useCallback(() => {
    stopRequested.current = true
    active.current?.abort()
  }, [])

  const clear = useCallback(() => {
    stop()
    optionsRef.current.onEnd?.()
    persist()
    session.current = { id: uuid(), createdAt: new Date().toISOString() }
    cache.current.clear()
    setAttached([])
    setMessages([])
  }, [persist, stop])

  // Closing the bubble (or leaving the page) ends the session.
  useEffect(() => () => {
    stopRequested.current = true
    active.current?.abort()
    optionsRef.current.onEnd?.()
    persist()
  }, [persist])

  return {
    config, messages, messagesRef, busy, progress, run, stop, clear, add, patch, attached, setAttached, saveNow,
  }
}
