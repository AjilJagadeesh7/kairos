/**
 * Anthropic Messages API wire format (POST /v1/messages, verified against
 * platform.claude.com/docs, Oct 2026): request bodies, responses, stream
 * events, and which optional parameters to drop when a model rejects them
 * (newer models reject `temperature`; not every model takes adaptive
 * thinking or structured outputs).
 */
import type { GenOpts, JSONSchema, Msg, TokenUsage, ToolDef } from '../../types'
import type { RawToolCall } from './toolCalls'
import { THINKING_HEADROOM } from './toolCalls'

export const ANTHROPIC_VERSION = '2023-06-01'

export interface AnthropicFlags {
  sendTemperature: boolean
  /** schema = output_config.format json_schema; prompt = instructions only. */
  jsonMode: 'schema' | 'prompt'
  thinking: 'adaptive' | 'off'
  nativeTools: boolean
}

export const DEFAULT_ANTHROPIC_FLAGS: AnthropicFlags = { sendTemperature: true, jsonMode: 'schema', thinking: 'adaptive', nativeTools: true }

type Turn = { role: 'user' | 'assistant'; content: string }

/** System messages go to `system`; turns alternate, starting with the user. */
export function toAnthropicMessages(messages: Msg[]): { system?: string; messages: Turn[] } {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const turns: Turn[] = []
  for (const m of messages) {
    if (m.role === 'system') continue
    const role = m.role === 'assistant' ? 'assistant' : 'user'
    const content = m.role === 'tool' ? `Tool result${m.toolCallId ? ` (${m.toolCallId})` : ''}:\n${m.content}` : m.content
    const last = turns.at(-1)
    if (last?.role === role) last.content = `${last.content}\n\n${content}`
    else turns.push({ role, content })
  }
  if (turns[0]?.role === 'assistant') turns.unshift({ role: 'user', content: '(continue)' })
  for (const t of turns) if (!t.content.trim()) t.content = '(empty)'
  return { ...(system ? { system } : {}), messages: turns }
}

/**
 * Structured outputs accept a JSON Schema subset: no length or numeric
 * bounds, array bounds only 0/1, `additionalProperties: false` on objects.
 * The full schema is still enforced by our validator afterwards.
 */
export function strictSchema(s: JSONSchema): JSONSchema {
  const { minLength: _a, maxLength: _b, minimum: _c, maximum: _d, maxItems: _e, minItems, ...rest } = s
  const out: JSONSchema = { ...rest }
  if (minItems !== undefined && minItems <= 1) out.minItems = minItems
  if (s.items) out.items = strictSchema(s.items)
  if (s.properties) {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, strictSchema(v)]))
  }
  if (s.type === 'object') out.additionalProperties = false
  return out
}

export function buildAnthropicBody(
  model: string, messages: Msg[], opts: GenOpts, flags: AnthropicFlags,
  extras: { stream?: boolean; schema?: JSONSchema; tools?: ToolDef[] } = {},
): Record<string, unknown> {
  const { system, messages: turns } = toAnthropicMessages(messages)
  const thinking = opts.thinking && flags.thinking === 'adaptive'
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens + (thinking ? THINKING_HEADROOM : 0),
    messages: turns,
  }
  if (system) body.system = system
  // Thinking doesn't combine with a temperature change.
  if (thinking) body.thinking = { type: 'adaptive' }
  else if (flags.sendTemperature) body.temperature = opts.temperature
  if (opts.stop?.length) body.stop_sequences = opts.stop
  if (extras.stream) body.stream = true
  if (extras.schema && flags.jsonMode === 'schema') {
    body.output_config = { format: { type: 'json_schema', schema: strictSchema(extras.schema) } }
  }
  if (extras.tools && flags.nativeTools) {
    body.tools = extras.tools.map((t) => ({ name: t.name, description: t.description, input_schema: { type: 'object', ...t.parameters } }))
  }
  return body
}

/** If a 400 names an optional parameter we sent, flags without it; otherwise null (a real error). */
export function adaptAnthropic(message: string, flags: AnthropicFlags, body: Record<string, unknown>): AnthropicFlags | null {
  const msg = message.toLowerCase()
  if ('temperature' in body && msg.includes('temperature')) return { ...flags, sendTemperature: false }
  if ('thinking' in body && msg.includes('thinking')) return { ...flags, thinking: 'off' }
  if ('output_config' in body && (msg.includes('output_config') || msg.includes('json_schema') || msg.includes('structured') || msg.includes('format'))) {
    return { ...flags, jsonMode: 'prompt' }
  }
  if ('tools' in body && msg.includes('tool')) return { ...flags, nativeTools: false }
  return null
}

function toUsage(u: unknown): TokenUsage | null {
  const usage = u as { input_tokens?: number; output_tokens?: number } | undefined
  if (!usage || typeof usage.input_tokens !== 'number') return null
  return { promptTokens: usage.input_tokens, completionTokens: usage.output_tokens ?? 0 }
}

/** A non-streaming Message: text blocks joined (thinking skipped), tool_use blocks as calls. */
export function parseAnthropicMessage(text: string): { content: string; toolCalls: RawToolCall[]; usage: TokenUsage | null } {
  const body = JSON.parse(text) as {
    type?: string
    content?: Array<{ type?: string; text?: string; id?: string; name?: string; input?: unknown }>
    usage?: unknown
  }
  if (!Array.isArray(body.content)) throw new Error('not a message')
  return {
    content: body.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
    toolCalls: body.content.filter((b) => b.type === 'tool_use').map((b, i) => ({ id: b.id ?? `call_${i}`, name: b.name ?? '', arguments: b.input ?? {} })),
    usage: toUsage(body.usage),
  }
}

export interface AnthropicDelta {
  text: string
  /** Prompt tokens arrive in message_start, output tokens in message_delta. */
  inputTokens?: number
  outputTokens?: number
  done: boolean
}

/** One SSE `data:` payload of a streamed Message. Throws on an `error` event. */
export function parseAnthropicEvent(data: string): AnthropicDelta {
  const e = JSON.parse(data) as {
    type?: string
    delta?: { type?: string; text?: string }
    message?: { usage?: { input_tokens?: number } }
    usage?: { output_tokens?: number }
    error?: { type?: string; message?: string }
  }
  switch (e.type) {
    case 'content_block_delta':
      return { text: e.delta?.type === 'text_delta' ? e.delta.text ?? '' : '', done: false }
    case 'message_start':
      return { text: '', inputTokens: e.message?.usage?.input_tokens, done: false }
    case 'message_delta':
      return { text: '', outputTokens: e.usage?.output_tokens, done: false }
    case 'message_stop':
      return { text: '', done: true }
    case 'error':
      throw new Error(e.error?.message ?? e.error?.type ?? 'stream error')
    default:
      return { text: '', done: false }
  }
}

/** Model ids from GET /v1/models (`{ data: [{ id }] }`, newest first). */
export function parseAnthropicModels(text: string): string[] {
  const body = JSON.parse(text) as { data?: Array<{ id?: string }> }
  return (body.data ?? []).map((m) => m.id ?? '').filter(Boolean)
}
