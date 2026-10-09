/**
 * Gemini API wire format (generativelanguage.googleapis.com/v1beta,
 * `models.generateContent` / `streamGenerateContent?alt=sse`,
 * `batchEmbedContents`, `models.list`; verified against ai.google.dev/api,
 * Oct 2026).
 */
import type { GenOpts, JSONSchema, Msg, TokenUsage, ToolDef } from '../../types'
import type { RawToolCall } from './toolCalls'
import { THINKING_HEADROOM } from './toolCalls'

export interface GeminiFlags {
  sendTemperature: boolean
  /** schema = responseJsonSchema; mime = JSON mime type only; prompt = instructions only. */
  jsonMode: 'schema' | 'mime' | 'prompt'
  /** budget0 = turn thinking off with thinkingBudget 0 when not wanted; none = leave the model's default. */
  thinkingOff: 'budget0' | 'none'
  nativeTools: boolean
}

export const DEFAULT_GEMINI_FLAGS: GeminiFlags = { sendTemperature: true, jsonMode: 'schema', thinkingOff: 'budget0', nativeTools: true }

/** `models/gemini-2.5-flash` and `gemini-2.5-flash` both name the same model. */
export const modelPath = (model: string) => `/models/${model.trim().replace(/^models\//, '')}`

type Content = { role: 'user' | 'model'; parts: Array<{ text: string }> }

export function toGeminiContents(messages: Msg[]): { systemInstruction?: { parts: Array<{ text: string }> }; contents: Content[] } {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const contents: Content[] = []
  for (const m of messages) {
    if (m.role === 'system') continue
    const role = m.role === 'assistant' ? 'model' : 'user'
    const text = m.role === 'tool' ? `Tool result${m.toolCallId ? ` (${m.toolCallId})` : ''}:\n${m.content}` : m.content
    const last = contents.at(-1)
    if (last?.role === role) last.parts[0].text = `${last.parts[0].text}\n\n${text}`
    else contents.push({ role, parts: [{ text: text || '(empty)' }] })
  }
  if (contents[0]?.role === 'model') contents.unshift({ role: 'user', parts: [{ text: '(continue)' }] })
  return { ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents }
}

/** responseJsonSchema doesn't take string length bounds; our validator still checks them. */
export function geminiSchema(s: JSONSchema): JSONSchema {
  const { minLength: _a, maxLength: _b, ...rest } = s
  const out: JSONSchema = { ...rest }
  if (s.items) out.items = geminiSchema(s.items)
  if (s.properties) out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, geminiSchema(v)]))
  return out
}

export function buildGeminiBody(
  messages: Msg[], opts: GenOpts, flags: GeminiFlags, extras: { schema?: JSONSchema; tools?: ToolDef[] } = {},
): Record<string, unknown> {
  // With thinking left on (wanted, or the model can't turn it off), it shares maxOutputTokens with the answer.
  const thinks = opts.thinking || flags.thinkingOff === 'none'
  const config: Record<string, unknown> = { maxOutputTokens: opts.maxTokens + (thinks ? THINKING_HEADROOM : 0) }
  if (flags.sendTemperature) config.temperature = opts.temperature
  if (opts.stop?.length) config.stopSequences = opts.stop.slice(0, 5)
  if (!opts.thinking && flags.thinkingOff === 'budget0') config.thinkingConfig = { thinkingBudget: 0 }
  if (extras.schema && flags.jsonMode !== 'prompt') {
    config.responseMimeType = 'application/json'
    if (flags.jsonMode === 'schema') config.responseJsonSchema = geminiSchema(extras.schema)
  }
  const body: Record<string, unknown> = { ...toGeminiContents(messages), generationConfig: config }
  if (extras.tools && flags.nativeTools) {
    body.tools = [{
      functionDeclarations: extras.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: { type: 'object', ...t.parameters } })),
    }]
  }
  return body
}

export function adaptGemini(message: string, flags: GeminiFlags, body: Record<string, unknown>): GeminiFlags | null {
  const msg = message.toLowerCase()
  const config = (body.generationConfig ?? {}) as Record<string, unknown>
  if ('thinkingConfig' in config && (msg.includes('thinking') || msg.includes('budget'))) return { ...flags, thinkingOff: 'none' }
  if ('temperature' in config && msg.includes('temperature')) return { ...flags, sendTemperature: false }
  if ('responseJsonSchema' in config && (msg.includes('response_json_schema') || msg.includes('responsejsonschema') || msg.includes('schema'))) {
    return { ...flags, jsonMode: 'mime' }
  }
  if ('responseMimeType' in config && (msg.includes('mime') || msg.includes('json mode'))) return { ...flags, jsonMode: 'prompt' }
  if ('tools' in body && (msg.includes('function') || msg.includes('tool') || msg.includes('parameters'))) return { ...flags, nativeTools: false }
  return null
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean; functionCall?: { id?: string; name?: string; args?: unknown } }> }
    finishReason?: string
  }>
  promptFeedback?: { blockReason?: string }
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
  error?: { message?: string }
}

function toUsage(u: GeminiResponse['usageMetadata']): TokenUsage | null {
  if (!u || typeof u.promptTokenCount !== 'number') return null
  return { promptTokens: u.promptTokenCount, completionTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) }
}

/** One response (or stream chunk): answer text (thoughts skipped), function calls, usage. */
export function parseGeminiResponse(text: string): { content: string; toolCalls: RawToolCall[]; usage: TokenUsage | null; blocked: string | null } {
  const body = JSON.parse(text) as GeminiResponse
  if (body.error) throw new Error(body.error.message ?? 'error')
  const candidate = body.candidates?.[0]
  const parts = candidate?.content?.parts ?? []
  const blocked = body.promptFeedback?.blockReason
    ?? (candidate?.finishReason && ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(candidate.finishReason) && !parts.length ? candidate.finishReason : null)
  return {
    content: parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join(''),
    toolCalls: parts.filter((p) => p.functionCall).map((p, i) => ({ id: p.functionCall!.id ?? `call_${i}`, name: p.functionCall!.name ?? '', arguments: p.functionCall!.args ?? {} })),
    usage: toUsage(body.usageMetadata),
    blocked: blocked ?? null,
  }
}

/** Model ids (without `models/`) that support `method`, from GET /models. */
export function parseGeminiModels(text: string, method: 'generateContent' | 'embedContent'): string[] {
  const body = JSON.parse(text) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }
  return (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes(method))
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter(Boolean)
}

export function buildEmbedBody(model: string, texts: string[], task: 'document' | 'query'): Record<string, unknown> {
  const name = `models/${model.trim().replace(/^models\//, '')}`
  return {
    requests: texts.map((text) => ({
      model: name,
      content: { parts: [{ text }] },
      taskType: task === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
    })),
  }
}

export function parseEmbedResponse(text: string): number[][] {
  const body = JSON.parse(text) as { embeddings?: Array<{ values?: number[] }> }
  return (body.embeddings ?? []).map((e) => e.values ?? [])
}
