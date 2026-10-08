/** Quick-fill presets for the provider editor. All use the OpenAI-compatible adapter. */
export interface ProviderPreset {
  label: string
  name: string
  baseUrl: string
  needsKey: boolean
  contextTokens: number
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { label: 'Ollama',       name: 'Ollama',       baseUrl: 'http://localhost:11434/v1',      needsKey: false, contextTokens: 8192 },
  { label: 'LM Studio',    name: 'LM Studio',    baseUrl: 'http://localhost:1234/v1',       needsKey: false, contextTokens: 8192 },
  { label: 'llama-server', name: 'llama-server', baseUrl: 'http://localhost:8080/v1',       needsKey: false, contextTokens: 8192 },
  { label: 'OpenRouter',   name: 'OpenRouter',   baseUrl: 'https://openrouter.ai/api/v1',   needsKey: true,  contextTokens: 32000 },
  { label: 'OpenAI',       name: 'OpenAI',       baseUrl: 'https://api.openai.com/v1',      needsKey: true,  contextTokens: 32000 },
  { label: 'Groq',         name: 'Groq',         baseUrl: 'https://api.groq.com/openai/v1', needsKey: true,  contextTokens: 32000 },
]

/** Prompt budget cap per PRD: scaled from the provider's window, 32k by default. */
export const MAX_CONTEXT_TOKENS = 32000
