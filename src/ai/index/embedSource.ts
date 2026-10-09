/**
 * The embedding source picked in Settings → AI → Semantic index (PRD):
 * the on-device model, a provider's embeddings endpoint, or keyword only.
 * The index records the model id it was built with; when the active id
 * differs, semantic search is off until the index is rebuilt.
 */
import { useAiStore } from '../../store/useAiStore'
import { ON_DEVICE_MODEL } from './indexStorage'
import { normalize } from './buildIndex'
import { embeddingModelId, embeddingProviderFromConfig, supportsEmbeddings } from '../providers/registry'
import type { AiProviderConfig } from '../../types'

export interface ActiveEmbedder {
  modelId: string
  /** One vector per chunk. */
  embed: (text: string) => Promise<number[]>
  /** Whole documents at once, when the source batches (providers). */
  embedMany?: (texts: string[]) => Promise<number[][]>
  /** A unit-length query vector. */
  embedQuery: (text: string) => Promise<Float32Array | null>
}

/** The provider used for embeddings, when the source is 'provider' and it can embed. */
export function embeddingProviderConfig(): AiProviderConfig | null {
  const { indexSource, indexProviderId, providers } = useAiStore.getState()
  if (indexSource !== 'provider') return null
  const cfg = providers.find((p) => p.id === indexProviderId)
  return cfg && supportsEmbeddings(cfg) && cfg.embeddingModel?.trim() ? cfg : null
}

/** The model id the index should be built with now, or null (keyword only / not configured). */
export function activeModelId(): string | null {
  const { indexSource } = useAiStore.getState()
  if (indexSource === 'on-device') return ON_DEVICE_MODEL
  const cfg = embeddingProviderConfig()
  return cfg ? embeddingModelId(cfg) : null
}

let seq = 0

export async function activeEmbedder(): Promise<ActiveEmbedder | null> {
  const { indexSource } = useAiStore.getState()
  if (indexSource === 'on-device') {
    const { embedRaw } = await import('../../utils/embeddingClient')
    return {
      modelId: ON_DEVICE_MODEL,
      embed: (text) => embedRaw(`ai-index-${seq++}`, text),
      embedQuery: async (q) => {
        const v = await embedRaw(`chat-query-${seq++}`, q)
        return v.length ? normalize(v) : null
      },
    }
  }
  const cfg = embeddingProviderConfig()
  if (!cfg) return null
  // Consent and the AI toggle are enforced here like any other request.
  const provider = await embeddingProviderFromConfig(cfg)
  return {
    modelId: provider.modelId,
    embed: async (text) => Array.from((await provider.embed([text]))[0] ?? []),
    embedMany: async (texts) => (await provider.embed(texts)).map((v) => Array.from(v)),
    embedQuery: async (q) => normalize(await provider.embedQuery(q)),
  }
}
