/**
 * The provider the evals run against: any adapter type, picked with
 * AI_EVAL_TYPE (openai-compat | anthropic | gemini; default openai-compat).
 */
import { OpenAICompatProvider } from '../providers/openaiCompat'
import { AnthropicProvider } from '../providers/anthropic'
import { GeminiProvider } from '../providers/gemini'
import { fetchStream } from '../transport/httpStream'
import type { AiProviderConfig, AiProviderType } from '../../types'
import type { HttpProvider } from '../providers/httpProvider'

declare const process: { env: Record<string, string | undefined> }

export const evalType = (process.env.AI_EVAL_TYPE ?? 'openai-compat') as AiProviderType

export function evalAdapter(config: AiProviderConfig, apiKey: string | null): HttpProvider {
  switch (config.type) {
    case 'anthropic': return new AnthropicProvider(config, apiKey, fetchStream)
    case 'gemini': return new GeminiProvider(config, apiKey, fetchStream)
    default: return new OpenAICompatProvider(config, apiKey, fetchStream)
  }
}
