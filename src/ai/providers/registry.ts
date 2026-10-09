/**
 * The only way feature code obtains a provider. Enforces, before any request
 * can be made: the AI toggle is on, a cloud provider's consent was accepted,
 * and the API key comes from secure storage. Embeddings go through the same
 * checks — cloud embeddings send note text too.
 */
import { useAiStore, consentKey } from '../../store/useAiStore'
import { getSecret, setSecret, deleteSecret, SECRET_KEYS } from '../../secrets/secureStore'
import { checkProviderUrl, locationForUrl } from '../net/urlPolicy'
import { ProviderError } from './errors'
import { OpenAICompatProvider } from './openaiCompat'
import { AnthropicProvider } from './anthropic'
import { GeminiProvider } from './gemini'
import type { HttpProvider, Transport } from './httpProvider'
import { ON_DEVICE_PROVIDER_ID, onDeviceConfig } from '../onDevice/onDeviceConfig'
import { useOnDeviceStore } from '../../store/useOnDeviceStore'
import type { AiProviderConfig, AiSurface, EmbeddingProvider, LLMProvider } from '../../types'

export function needsConsent(cfg: Pick<AiProviderConfig, 'id' | 'baseUrl'>): boolean {
  if (locationForUrl(cfg.baseUrl) !== 'cloud') return false
  return !useAiStore.getState().consents[consentKey(cfg)]
}

export const getProviderKey = (id: string) => getSecret(SECRET_KEYS.aiProvider(id))
export const setProviderKey = (id: string, key: string) => setSecret(SECRET_KEYS.aiProvider(id), key.trim())
export const deleteProviderKey = (id: string) => deleteSecret(SECRET_KEYS.aiProvider(id))

export interface ProviderOptions {
  /** Use this key instead of the stored one (Test connection on an unsaved edit). */
  apiKey?: string | null
  transport?: Transport
}

/** Adding a provider type = a new adapter file, a case here, and a settings entry. */
function adapterFor(cfg: AiProviderConfig, apiKey: string | null, transport?: Transport): HttpProvider {
  switch (cfg.type) {
    case 'anthropic': return new AnthropicProvider(cfg, apiKey, transport)
    case 'gemini': return new GeminiProvider(cfg, apiKey, transport)
    case 'openai-compat':
    default: return new OpenAICompatProvider(cfg, apiKey, transport)
  }
}

export async function providerFromConfig(cfg: AiProviderConfig, opts: ProviderOptions = {}): Promise<HttpProvider> {
  if (!useAiStore.getState().enabled) {
    throw new ProviderError('disabled', 'The AI assistant is turned off in Settings → AI')
  }
  if (cfg.type === 'on-device') throw new ProviderError('config', 'The on-device model is chosen per surface, not configured as an HTTP provider')
  const url = checkProviderUrl(cfg.baseUrl)
  if (!url.ok) throw new ProviderError('config', url.reason)
  if (!cfg.model.trim()) throw new ProviderError('config', 'Choose a model for this provider')
  if (needsConsent(cfg)) {
    throw new ProviderError('consent', `Allow Kairos to send content to ${cfg.name} before using it`)
  }
  const apiKey = opts.apiKey !== undefined ? opts.apiKey : await getProviderKey(cfg.id)
  if (cfg.type !== 'openai-compat' && !apiKey) {
    throw new ProviderError('config', `Add an API key for ${cfg.name} in Settings → AI`)
  }
  const provider = adapterFor(cfg, apiKey || null, opts.transport)
  // Token metering for the optional monthly threshold — counts only, stays on the device.
  provider.onUsage = (u) => useAiStore.getState().recordUsage(u)
  return provider
}

/** The config a surface uses: a configured provider, or the built-in on-device model (Full build). */
export function surfaceConfig(surface: AiSurface): AiProviderConfig | null {
  const { providers, surfaceProvider } = useAiStore.getState()
  const id = surfaceProvider[surface]
  if (id === ON_DEVICE_PROVIDER_ID) {
    const { modelId, readyPath } = useOnDeviceStore.getState()
    return onDeviceConfig(modelId, readyPath)
  }
  return providers.find((p) => p.id === id) ?? null
}

/** The provider the user picked for a surface (global chat / page bubble). */
export async function providerForSurface(surface: AiSurface): Promise<{ provider: LLMProvider; config: AiProviderConfig }> {
  const config = surfaceConfig(surface)
  // Full builds only: Lite never loads the on-device code (the constant drops this branch).
  if (__BUILD_FLAVOR__ === 'full' && config?.type === 'on-device') {
    if (!useAiStore.getState().enabled) throw new ProviderError('disabled', 'The AI assistant is turned off in Settings → AI')
    const { onDeviceProvider } = await import('../onDevice/onDeviceSession')
    const provider = await onDeviceProvider()
    provider.onUsage = (u) => useAiStore.getState().recordUsage(u)
    return { provider, config }
  }
  if (!config) {
    throw new ProviderError('config', `No provider selected for the ${surface === 'global' ? 'global chat' : 'page bubble'} — choose one in Settings → AI`)
  }
  return { provider: await providerFromConfig(config), config }
}

/** Whether a provider type has an embeddings endpoint (Anthropic has none). */
export const supportsEmbeddings = (cfg: Pick<AiProviderConfig, 'type'>) => cfg.type !== 'anthropic'

/** The index records this; a different provider, server or model needs a rebuild. */
export function embeddingModelId(cfg: Pick<AiProviderConfig, 'type' | 'baseUrl' | 'embeddingModel'>): string {
  let host = cfg.baseUrl
  try { host = new URL(cfg.baseUrl).host } catch { /* keep raw */ }
  return `${cfg.type}:${host}:${cfg.embeddingModel?.trim() ?? ''}`
}

export interface ProviderEmbedder extends EmbeddingProvider {
  /** Query-side vectors (Gemini embeds queries and documents differently). */
  embedQuery(text: string): Promise<Float32Array>
}

/** Embeddings through a configured provider (PRD "provider embeddings"). */
export async function embeddingProviderFromConfig(cfg: AiProviderConfig, opts: ProviderOptions = {}): Promise<ProviderEmbedder> {
  if (!supportsEmbeddings(cfg)) {
    throw new ProviderError('config', `${cfg.name} has no embeddings endpoint — pick another provider for semantic search, or use keyword search`)
  }
  const model = cfg.embeddingModel?.trim()
  if (!model) throw new ProviderError('config', `Choose an embedding model for ${cfg.name} in Settings → AI`)
  const provider = await providerFromConfig(cfg, opts) as OpenAICompatProvider | GeminiProvider
  const toF32 = (vs: number[][]) => vs.map((v) => Float32Array.from(v))
  const out: ProviderEmbedder = {
    modelId: embeddingModelId(cfg),
    dims: 0,
    async embed(texts) {
      const vs = toF32(await provider.embed(texts, model, 'document'))
      out.dims = vs[0]?.length ?? out.dims
      return vs
    },
    async embedQuery(text) {
      const [v] = toF32(await provider.embed([text], model, 'query'))
      return v
    },
  }
  return out
}
