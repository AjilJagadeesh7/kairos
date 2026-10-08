import { useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useAiStore } from '../store/useAiStore'
import { providerFromConfig } from '../ai/providers/registry'
import { runJsonCheck, type JsonCheckResult } from '../ai/debug/jsonCheck'
import type { AiDebugTurn, LLMProvider, Msg } from '../types'

const GEN = { maxTokens: 1024, temperature: 0.7, thinking: false }

/** Hidden debug chat: streams raw output from one provider, with Stop. */
export function useAiDebugChat(providerId: string | null) {
  const providers = useAiStore((s) => s.providers)
  const [turns, setTurns] = useState<AiDebugTurn[]>([])
  const [busy, setBusy] = useState(false)
  const [check, setCheck] = useState<JsonCheckResult | null>(null)
  const active = useRef<LLMProvider | null>(null)
  const stopRequested = useRef(false)

  const config = providers.find((p) => p.id === providerId) ?? null

  const patchTurn = (id: string, patch: (t: AiDebugTurn) => AiDebugTurn) =>
    setTurns((ts) => ts.map((t) => (t.id === id ? patch(t) : t)))

  async function withProvider(run: (p: LLMProvider) => Promise<void>, errorTurn: boolean) {
    if (!config || busy) return
    setBusy(true)
    stopRequested.current = false
    try {
      const provider = await providerFromConfig(config)
      active.current = provider
      await run(provider)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (errorTurn) setTurns((ts) => [...ts, { id: uuid(), role: 'error', content: message }])
      else setCheck({ passed: 0, failed: 0, errors: [message] })
    } finally {
      active.current = null
      setBusy(false)
    }
  }

  async function send(text: string) {
    const content = text.trim()
    if (!content) return
    const user: AiDebugTurn = { id: uuid(), role: 'user', content }
    const reply: AiDebugTurn = { id: uuid(), role: 'assistant', content: '' }
    const history: Msg[] = [...turns, user]
      .filter((t) => t.role !== 'error')
      .map((t) => ({ role: t.role as 'user' | 'assistant', content: t.content }))
    setTurns((ts) => [...ts, user, reply])

    await withProvider(async (provider) => {
      for await (const delta of provider.generate(history, GEN)) {
        patchTurn(reply.id, (t) => ({ ...t, content: t.content + delta }))
      }
      const usage = provider.lastUsage() ?? undefined
      patchTurn(reply.id, (t) => ({ ...t, usage }))
    }, true)
  }

  async function jsonCheck() {
    setCheck({ passed: 0, failed: 0, errors: [] })
    await withProvider(async (provider) => {
      await runJsonCheck(provider, setCheck, () => stopRequested.current)
    }, false)
  }

  function stop() {
    stopRequested.current = true
    active.current?.abort()
  }

  return { config, turns, busy, check, send, jsonCheck, stop, clear: () => { setTurns([]); setCheck(null) } }
}
