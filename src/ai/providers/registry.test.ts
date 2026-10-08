import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { providerFromConfig, providerForSurface, needsConsent, setProviderKey } from './registry'
import { useAiStore } from '../../store/useAiStore'
import { setSecretBackendForTests } from '../../secrets/secureStore'
import type { Transport } from './openaiCompat'
import type { AiProviderConfig } from '../../types'

const cloud: AiProviderConfig = {
  id: 'or', type: 'openai-compat', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1',
  model: 'some/model', verified: true, contextTokens: 32000, createdAt: '2026-10-08T00:00:00Z',
}
const local: AiProviderConfig = { ...cloud, id: 'ol', name: 'Ollama', baseUrl: 'http://localhost:11434/v1' }

let sent = 0
const transport: Transport = async () => {
  sent++
  async function* body() { yield '{"choices":[{"message":{"content":"OK"}}]}' }
  return { status: 200, body: body() }
}

beforeEach(() => {
  sent = 0
  const secrets = new Map<string, string>()
  setSecretBackendForTests({
    get: async (k) => secrets.get(k) ?? null,
    set: async (k, v) => { secrets.set(k, v) },
    remove: async (k) => { secrets.delete(k) },
  })
  useAiStore.setState({ enabled: true, providers: [cloud, local], surfaceProvider: { global: null, bubble: null }, consents: {} })
})

afterEach(() => setSecretBackendForTests(null))

describe('provider registry gates', () => {
  it('refuses everything while the AI toggle is off', async () => {
    useAiStore.setState({ enabled: false })
    await expect(providerFromConfig(local, { transport })).rejects.toMatchObject({ kind: 'disabled' })
  })

  it('blocks a cloud provider until consent is granted — no request is sent', async () => {
    expect(needsConsent(cloud)).toBe(true)
    await expect(providerFromConfig(cloud, { transport })).rejects.toMatchObject({ kind: 'consent' })
    expect(sent).toBe(0)

    useAiStore.getState().grantConsent(cloud)
    const p = await providerFromConfig(cloud, { transport })
    await p.testConnection()
    expect(sent).toBeGreaterThan(0)
  })

  it('asks again when the provider points at a different host', () => {
    useAiStore.getState().grantConsent(cloud)
    expect(needsConsent({ ...cloud, baseUrl: 'https://api.groq.com/openai/v1' })).toBe(true)
  })

  it('never needs consent for self-hosted providers', () => {
    expect(needsConsent(local)).toBe(false)
  })

  it('rejects plain HTTP to a public host', async () => {
    await expect(providerFromConfig({ ...local, baseUrl: 'http://example.com/v1' }, { transport }))
      .rejects.toMatchObject({ kind: 'config' })
  })

  it('reads the key from secure storage', async () => {
    await setProviderKey('ol', '  sk-local  ')
    let auth: string | undefined
    const capture: Transport = async (req) => { auth = req.headers.Authorization; return transport(req) }
    await (await providerFromConfig(local, { transport: capture })).testConnection()
    expect(auth).toBe('Bearer sk-local')
  })

  it('only verified providers can be selected for a surface', async () => {
    useAiStore.setState({ providers: [{ ...local, verified: false }] })
    useAiStore.getState().setSurfaceProvider('global', 'ol')
    expect(useAiStore.getState().surfaceProvider.global).toBeNull()
    await expect(providerForSurface('global')).rejects.toMatchObject({ kind: 'config' })
  })

  it('changing the destination unselects the provider and requires a new test', () => {
    useAiStore.getState().setSurfaceProvider('bubble', 'ol')
    expect(useAiStore.getState().surfaceProvider.bubble).toBe('ol')
    useAiStore.getState().updateProvider('ol', { baseUrl: 'http://192.168.1.9:11434/v1' })
    const p = useAiStore.getState().providers.find((x) => x.id === 'ol')!
    expect(p.verified).toBe(false)
    expect(useAiStore.getState().surfaceProvider.bubble).toBeNull()
  })
})
