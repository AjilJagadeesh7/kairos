/**
 * OpenAI Chat Completions wire format: request bodies, response parsing, and
 * learning which optional parameters a server accepts. "OpenAI-compatible"
 * servers differ (OpenAI reasoning models reject `max_tokens`/`temperature`,
 * Ollama models may reject `tools`, some servers lack `json_schema`), so a
 * 400 that names a parameter flips the matching flag and the call is retried.
 */
import type { Msg, GenOpts, TokenUsage, ToolDef, JSONSchema } from '../../types'

export interface CompatFlags {
  maxTokensParam: 'max_tokens' | 'max_completion_tokens'
  sendTemperature: boolean
  streamUsage: boolean
  /** schema = response_format json_schema; object = json_object; prompt = instructions only. */
  jsonMode: 'schema' | 'object' | 'prompt'
  nativeTools: boolean
}

export const DEFAULT_FLAGS: CompatFlags = {
  maxTokensParam: 'max_tokens',
  sendTemperature: true,
  streamUsage: true,
  jsonMode: 'schema',
  nativeTools: true,
}

type WireMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { role: 'tool'; content: string; tool_call_id: string }

export function toWireMessages(messages: Msg[]): WireMessage[] {
  return messages.map((m) => m.role === 'tool'
    ? { role: 'tool', content: m.content, tool_call_id: m.toolCallId ?? '' }
    : { role: m.role, content: m.content })
}

export interface BodyExtras {
  stream?: boolean
  schema?: JSONSchema
  tools?: ToolDef[]
}

export function buildBody(
  model: string, messages: Msg[], opts: GenOpts, flags: CompatFlags, extras: BodyExtras = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: toWireMessages(messages),
    [flags.maxTokensParam]: opts.maxTokens,
  }
  if (flags.sendTemperature) body.temperature = opts.temperature
  if (opts.stop?.length) body.stop = opts.stop
  if (extras.stream) {
    body.stream = true
    if (flags.streamUsage) body.stream_options = { include_usage: true }
  }
  if (extras.schema && flags.jsonMode === 'schema') {
    body.response_format = { type: 'json_schema', json_schema: { name: 'output', schema: extras.schema } }
  } else if (extras.schema && flags.jsonMode === 'object') {
    body.response_format = { type: 'json_object' }
  }
  if (extras.tools && flags.nativeTools) {
    body.tools = extras.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }))
  }
  return body
}

/**
 * If a 400/422 says the server rejected an optional parameter we sent, returns
 * flags without it; otherwise null (the error is real).
 */
export function adaptToRejection(
  status: number, errorMessage: string, flags: CompatFlags, body: Record<string, unknown>,
): CompatFlags | null {
  if (status !== 400 && status !== 422) return null
  const msg = errorMessage.toLowerCase()
  if ('max_tokens' in body && msg.includes('max_tokens')) {
    return { ...flags, maxTokensParam: 'max_completion_tokens' }
  }
  if ('temperature' in body && msg.includes('temperature')) {
    return { ...flags, sendTemperature: false }
  }
  if ('stream_options' in body && msg.includes('stream_options')) {
    return { ...flags, streamUsage: false }
  }
  if ('response_format' in body && (msg.includes('response_format') || msg.includes('json_schema') || msg.includes('json_object'))) {
    return { ...flags, jsonMode: flags.jsonMode === 'schema' ? 'object' : 'prompt' }
  }
  if ('tools' in body && msg.includes('tool')) {
    return { ...flags, nativeTools: false }
  }
  return null
}

function toUsage(u: unknown): TokenUsage | null {
  const usage = u as { prompt_tokens?: number; completion_tokens?: number } | null | undefined
  if (!usage || typeof usage.prompt_tokens !== 'number') return null
  return { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens ?? 0 }
}

export interface StreamDelta {
  content: string
  usage: TokenUsage | null
  done: boolean
}

/** Parses one SSE `data:` payload from a streaming completion. */
export function parseStreamEvent(data: string): StreamDelta {
  if (data.trim() === '[DONE]') return { content: '', usage: null, done: true }
  const event = JSON.parse(data) as {
    choices?: Array<{ delta?: { content?: string | null } }>
    usage?: unknown
    error?: { message?: string } | string
  }
  if (event.error) {
    const message = typeof event.error === 'string' ? event.error : event.error.message ?? 'stream error'
    throw new Error(message)
  }
  return {
    content: event.choices?.[0]?.delta?.content ?? '',
    usage: toUsage(event.usage),
    done: false,
  }
}

export interface WireToolCall {
  id: string
  name: string
  /** Raw JSON string as sent by the model. */
  arguments: string
}

export interface Completion {
  content: string
  toolCalls: WireToolCall[]
  usage: TokenUsage | null
}

export function parseCompletion(text: string): Completion {
  const body = JSON.parse(text) as {
    choices?: Array<{
      message?: {
        content?: string | null
        tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string | object } }>
      }
    }>
    usage?: unknown
  }
  const message = body.choices?.[0]?.message
  return {
    content: message?.content ?? '',
    toolCalls: (message?.tool_calls ?? []).map((c, i) => ({
      id: c.id ?? `call_${i}`,
      name: c.function?.name ?? '',
      // Some servers (Ollama) send arguments as an object rather than a string.
      arguments: typeof c.function?.arguments === 'string'
        ? c.function.arguments
        : JSON.stringify(c.function?.arguments ?? {}),
    })),
    usage: toUsage(body.usage),
  }
}

/** Model ids from GET /models (`{ data: [{ id }] }`). */
export function parseModelList(text: string): string[] {
  const body = JSON.parse(text) as { data?: Array<{ id?: string }> }
  return (body.data ?? []).map((m) => m.id ?? '').filter(Boolean).sort()
}
