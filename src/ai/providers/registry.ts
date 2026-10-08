/**
 * The only way feature code obtains a provider. Enforces, before any request
 * can be made: the AI toggle is on, a cloud provider's consent was accepted,
 * and the API key comes from secure storage.
 */
import { useAiStore, consentKey } from '../../store/useAiStore'
import { getSecret, setSecret, deleteSecret, SECRET_KEYS } from '../../secrets/secureStore'
import { checkProviderUrl, locationForUrl } from '../net/urlPolicy'
import { ProviderError } from './errors'
import { OpenAICompatProvider, type Transport } from './openaiCompat'
import type { AiProviderConfig, AiSurface } from '../../types'

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

export async function providerFromConfig(cfg: AiProviderConfig, opts: ProviderOptions = {}): Promise<OpenAICompatProvider> {
  if (!useAiStore.getState().enabled) {
    throw new ProviderError('disabled', 'The AI assistant is turned off in Settings → AI')
  }
  const url = checkProviderUrl(cfg.baseUrl)
  if (!url.ok) throw new ProviderError('config', url.reason)
  if (!cfg.model.trim()) throw new ProviderError('config', 'Choose a model for this provider')
  if (needsConsent(cfg)) {
    throw new ProviderError('consent', `Allow Kairos to send content to ${cfg.name} before using it`)
  }
  const apiKey = opts.apiKey !== undefined ? opts.apiKey : await getProviderKey(cfg.id)

  switch (cfg.type) {
    case 'openai-compat':
      return new OpenAICompatProvider(cfg, apiKey || null, opts.transport)
  }
}

/** The provider the user picked for a surface (global chat / page bubble). */
export async function providerForSurface(surface: AiSurface): Promise<{ provider: OpenAICompatProvider; config: AiProviderConfig }> {
  const { providers, surfaceProvider } = useAiStore.getState()
  const config = providers.find((p) => p.id === surfaceProvider[surface])
  if (!config) {
    throw new ProviderError('config', `No provider selected for the ${surface === 'global' ? 'global chat' : 'page bubble'} — choose one in Settings → AI`)
  }
  return { provider: await providerFromConfig(config), config }
}
