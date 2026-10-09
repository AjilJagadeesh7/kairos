/** Shared types for the AI assistant: providers, messages, tools, settings. */

export type ProviderId =
  | 'capacitor-llama' | 'tauri-llama' | 'anthropic' | 'openai' | 'gemini' | 'openai-compat'

/** Where a request is sent. Derived from the base URL for custom providers. */
export type ProviderLocation = 'on-device' | 'self-hosted' | 'cloud'

export interface ProviderCapabilities {
  /** Provider-native tool/function calling. */
  nativeTools: boolean
  /** Constrained or schema-enforced JSON output. */
  jsonSchema: boolean
  contextTokens: number
  /** Exposes an embeddings endpoint. */
  embeddings: boolean
  location: ProviderLocation
}

export type MsgRole = 'system' | 'user' | 'assistant' | 'tool'

export interface Msg {
  role: MsgRole
  content: string
  /** For role 'tool': the id of the tool call this message answers. */
  toolCallId?: string
}

/** The subset of JSON Schema the validator and prompts understand. */
export interface JSONSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null'
  description?: string
  properties?: Record<string, JSONSchema>
  required?: string[]
  additionalProperties?: boolean
  items?: JSONSchema
  enum?: Array<string | number | boolean | null>
  minItems?: number
  maxItems?: number
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
}

export interface ToolDef {
  name: string
  description: string
  parameters: JSONSchema
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface GenOpts {
  maxTokens: number
  temperature: number
  thinking: boolean
  stop?: string[]
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
}

/** Shape the on-device runtime loads (P8). */
export interface ModelSpec {
  id: string
  url: string
  sha256: string
  sizeBytes: number
}

export interface LLMProvider {
  id: ProviderId
  capabilities: ProviderCapabilities
  isAvailable(): Promise<boolean>
  load?(model: ModelSpec): Promise<void>
  unload?(): Promise<void>
  /** Streams text deltas. Resolves when generation ends or `abort()` is called. */
  generate(messages: Msg[], opts: GenOpts): AsyncIterable<string>
  generateJSON<T>(messages: Msg[], schema: JSONSchema, opts: GenOpts): Promise<T>
  callTools(messages: Msg[], tools: ToolDef[], opts: GenOpts): Promise<ToolCall[]>
  abort(): void
  /** Usage reported by the most recent completed request, if the provider sent it. */
  lastUsage(): TokenUsage | null
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<Float32Array[]>
  dims: number
  /** The semantic index is tied to this; changing it triggers a rebuild. */
  modelId: string
}

// ── Settings ────────────────────────────────────────────────────────────────

/** Which adapter speaks to it. OpenAI itself uses `openai-compat`. */
export type AiProviderType = 'openai-compat' | 'anthropic' | 'gemini' | 'on-device'

/** A user-configured provider. The API key is NOT here — it lives in secure
 *  storage under `aiProviderSecretKey(id)`. */
export interface AiProviderConfig {
  id: string
  type: AiProviderType
  /** User-facing label, e.g. "Ollama on desktop". */
  name: string
  /** e.g. http://localhost:11434/v1 — no trailing slash. */
  baseUrl: string
  model: string
  /** True once Test connection passed with the current baseUrl/model/key. */
  verified: boolean
  /** Prompt-token budget cap for this provider. */
  contextTokens: number
  /** Embedding model for semantic search through this provider (not Anthropic: no endpoint). */
  embeddingModel?: string
  createdAt: string
}

/** This calendar month's token use across providers, for the optional threshold warning. */
export interface AiUsageMonth {
  /** YYYY-MM, local time. */
  month: string
  promptTokens: number
  completionTokens: number
  requests: number
}

export type AiSurface = 'global' | 'bubble'

// ── Debug chat ──────────────────────────────────────────────────────────────

export interface AiDebugTurn {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  usage?: TokenUsage
}
