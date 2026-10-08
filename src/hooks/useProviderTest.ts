import { useState } from 'react'
import { useAiStore } from '../store/useAiStore'
import { providerFromConfig, needsConsent } from '../ai/providers/registry'
import type { AiProviderConfig } from '../types'

export type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; models: string[] }
  | { status: 'error'; message: string }

/**
 * Test connection for the provider editor. A cloud provider's consent dialog
 * must be accepted first — the test itself is a request carrying the key.
 * `signature` identifies the values that passed, so editing any of them
 * invalidates the result.
 */
export function useProviderTest() {
  const grantConsent = useAiStore((s) => s.grantConsent)
  const [state, setState] = useState<TestState>({ status: 'idle' })
  const [passedSignature, setPassedSignature] = useState<string | null>(null)
  const [pendingConsent, setPendingConsent] = useState<{ draft: AiProviderConfig; apiKey?: string; signature: string } | null>(null)

  async function run(draft: AiProviderConfig, apiKey: string | undefined, signature: string) {
    setState({ status: 'testing' })
    try {
      const provider = await providerFromConfig(draft, { apiKey })
      const { models } = await provider.testConnection()
      setState({ status: 'ok', models })
      setPassedSignature(signature)
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      setPassedSignature(null)
    }
  }

  function test(draft: AiProviderConfig, apiKey: string | undefined, signature: string) {
    if (needsConsent(draft)) {
      setPendingConsent({ draft, apiKey, signature })
      return
    }
    void run(draft, apiKey, signature)
  }

  function acceptConsent() {
    if (!pendingConsent) return
    grantConsent(pendingConsent.draft)
    const { draft, apiKey, signature } = pendingConsent
    setPendingConsent(null)
    void run(draft, apiKey, signature)
  }

  return {
    state,
    test,
    passed: (signature: string) => passedSignature === signature,
    pendingConsent: pendingConsent?.draft ?? null,
    acceptConsent,
    cancelConsent: () => setPendingConsent(null),
  }
}
