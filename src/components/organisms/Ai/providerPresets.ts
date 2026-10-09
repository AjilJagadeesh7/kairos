/** Quick-fill presets and per-type defaults for the provider editor. */
import type { AiProviderType } from '../../../types'

export interface ProviderPreset {
  label: string
  type: AiProviderType
  name: string
  baseUrl: string
  needsKey: boolean
  contextTokens: number
  /** Suggested embedding model, when the provider has an embeddings endpoint. */
  embeddingModel?: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { label: 'Ollama',       type: 'openai-compat', name: 'Ollama',       baseUrl: 'http://localhost:11434/v1',      needsKey: false, contextTokens: 8192, embeddingModel: 'nomic-embed-text' },
  { label: 'LM Studio',    type: 'openai-compat', name: 'LM Studio',    baseUrl: 'http://localhost:1234/v1',       needsKey: false, contextTokens: 8192 },
  { label: 'llama-server', type: 'openai-compat', name: 'llama-server', baseUrl: 'http://localhost:8080/v1',       needsKey: false, contextTokens: 8192 },
  { label: 'Claude',       type: 'anthropic',     name: 'Claude',       baseUrl: 'https://api.anthropic.com/v1',   needsKey: true,  contextTokens: 32000 },
  { label: 'OpenAI',       type: 'openai-compat', name: 'OpenAI',       baseUrl: 'https://api.openai.com/v1',      needsKey: true,  contextTokens: 32000, embeddingModel: 'text-embedding-3-small' },
  { label: 'Gemini',       type: 'gemini',        name: 'Gemini',       baseUrl: 'https://generativelanguage.googleapis.com/v1beta', needsKey: true, contextTokens: 32000, embeddingModel: 'gemini-embedding-001' },
  { label: 'OpenRouter',   type: 'openai-compat', name: 'OpenRouter',   baseUrl: 'https://openrouter.ai/api/v1',   needsKey: true,  contextTokens: 32000 },
  { label: 'Groq',         type: 'openai-compat', name: 'Groq',         baseUrl: 'https://api.groq.com/openai/v1', needsKey: true,  contextTokens: 32000 },
]

export const PROVIDER_TYPES: Array<{ value: AiProviderType; label: string; urlLabel: string; urlPlaceholder: string; modelPlaceholder: string }> = [
  { value: 'openai-compat', label: 'OpenAI-compatible', urlLabel: 'Base URL (OpenAI-compatible)', urlPlaceholder: 'http://localhost:11434/v1', modelPlaceholder: 'e.g. qwen3:4b' },
  { value: 'anthropic', label: 'Anthropic (Claude)', urlLabel: 'API URL', urlPlaceholder: 'https://api.anthropic.com/v1', modelPlaceholder: 'e.g. claude-sonnet-5-5' },
  { value: 'gemini', label: 'Google Gemini', urlLabel: 'API URL', urlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta', modelPlaceholder: 'Test connection lists the models' },
]

/** Prompt budget cap per PRD: scaled from the provider's window, 32k by default. */
export const MAX_CONTEXT_TOKENS = 32000
