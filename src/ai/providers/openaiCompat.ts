/**
 * Adapter for any OpenAI Chat Completions server: Ollama, LM Studio,
 * llama-server, vLLM, OpenRouter, Groq, Mistral, Together, OpenAI itself.
 * Feature logic lives elsewhere — this file only speaks the wire protocol.
 */
import { streamHttp, AbortedError, type StreamRequest, type StreamResponse } from '../transport/httpStream'
import { parseSSE } from '../transport/sse'
import { extractJSON, validateJSON } from '../json/validate'
import { locationForUrl } from '../net/urlPolicy'
import { jsonInstruction, jsonRetryMessage, toolFallbackInstruction } from '../prompts/jsonOutput.v1'
import { ProviderError, errorForStatus, parseErrorBody } from './errors'
import { MAX_TOOLS_PER_CALL, toolFallbackSchema, validateToolCalls, type RawToolCall } from './toolCalls'
import {
  DEFAULT_FLAGS, adaptToRejection, buildBody, parseCompletion, parseModelList, parseStreamEvent,
  type BodyExtras, type CompatFlags, type Completion,
} from './openaiCompatWire'
import type {
  AiProviderConfig, GenOpts, JSONSchema, LLMProvider, Msg, ProviderCapabilities, TokenUsage, ToolCall, ToolDef,
} from '../../types'

export type Transport = (req: StreamRequest, signal?: AbortSignal) => Promise<StreamResponse>

const MAX_ADAPTATIONS = 5

/** The server (or model) doesn't support native tools — use the JSON fallback. */
class ToolsRejected extends ProviderError {
  constructor(name: string) { super('bad_request', `${name} doesn't support native tool calling`) }
}
const TEST_TIMEOUT_MS = 30_000

async function collect(body: AsyncIterable<string>, limit = 1_000_000): Promise<string> {
  let text = ''
  for await (const chunk of body) {
    text += chunk
    if (text.length > limit) break
  }
  return text
}

/** Adds an instruction to the system prompt (or creates one). */
function withSystem(messages: Msg[], instruction: string): Msg[] {
  if (messages[0]?.role === 'system') {
    return [{ ...messages[0], content: `${messages[0].content}\n\n${instruction}` }, ...messages.slice(1)]
  }
  return [{ role: 'system', content: instruction }, ...messages]
}

export class OpenAICompatProvider implements LLMProvider {
  readonly id = 'openai-compat' as const
  readonly capabilities: ProviderCapabilities
  private flags: CompatFlags = { ...DEFAULT_FLAGS }
  private readonly controllers = new Set<AbortController>()
  private usage: TokenUsage | null = null

  private readonly config: AiProviderConfig
  private readonly apiKey: string | null
  private readonly transport: Transport

  constructor(config: AiProviderConfig, apiKey: string | null, transport: Transport = streamHttp) {
    this.config = config
    this.apiKey = apiKey
    this.transport = transport
    this.capabilities = {
      nativeTools: true,
      jsonSchema: true,
      contextTokens: config.contextTokens,
      embeddings: true,
      location: locationForUrl(config.baseUrl),
    }
  }

  // ── plumbing ──────────────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`
    return h
  }

  private url(path: string): string {
    return `${this.config.baseUrl.replace(/\/+$/, '')}${path}`
  }

  private toProviderError(err: unknown, signal?: AbortSignal): ProviderError {
    if (err instanceof ProviderError) return err
    if ((signal?.reason as Error | undefined)?.name === 'TimeoutError') {
      return new ProviderError('network', `${this.config.name} didn't respond in time`)
    }
    if (err instanceof AbortedError || signal?.aborted) return new ProviderError('aborted', 'Stopped')
    const message = err instanceof Error ? err.message : String(err)
    return new ProviderError('network', `Couldn't reach ${this.config.name}: ${message}`)
  }

  private async send(req: StreamRequest, signal: AbortSignal): Promise<StreamResponse> {
    try {
      return await this.transport(req, signal)
    } catch (err) {
      throw this.toProviderError(err, signal)
    }
  }

  /** POST with automatic retry when the server rejects an optional parameter. */
  private async post(
    path: string, build: (flags: CompatFlags) => Record<string, unknown>, signal: AbortSignal,
  ): Promise<StreamResponse> {
    for (let i = 0; i <= MAX_ADAPTATIONS; i++) {
      const body = build(this.flags)
      const res = await this.send({ url: this.url(path), method: 'POST', headers: this.headers(), body: JSON.stringify(body) }, signal)
      if (res.status >= 200 && res.status < 300) return res
      const text = await collect(res.body)
      const adapted = adaptToRejection(res.status, parseErrorBody(text).message || text, this.flags, body)
      if (!adapted) throw errorForStatus(res.status, text, this.config.name)
      const toolsRejected = this.flags.nativeTools && !adapted.nativeTools
      this.flags = adapted
      // Resending without `tools` would be pointless — the caller switches to
      // the JSON fallback, which needs a different prompt.
      if (toolsRejected) throw new ToolsRejected(this.config.name)
    }
    throw new ProviderError('bad_request', `${this.config.name} kept rejecting the request parameters`)
  }

  private track(): AbortController {
    const ctrl = new AbortController()
    this.controllers.add(ctrl)
    return ctrl
  }

  private async complete(messages: Msg[], opts: GenOpts, extras: BodyExtras = {}, signal?: AbortSignal): Promise<Completion> {
    const ctrl = this.track()
    const onOuterAbort = () => ctrl.abort(signal?.reason)
    signal?.addEventListener('abort', onOuterAbort, { once: true })
    try {
      const res = await this.post('/chat/completions', (f) => buildBody(this.config.model, messages, opts, f, extras), ctrl.signal)
      const text = await collect(res.body)
      let completion: Completion
      try { completion = parseCompletion(text) } catch {
        throw new ProviderError('bad_request', `${this.config.name} sent a response that isn't a chat completion`)
      }
      this.usage = completion.usage
      return completion
    } catch (err) {
      throw this.toProviderError(err, ctrl.signal)
    } finally {
      signal?.removeEventListener('abort', onOuterAbort)
      this.controllers.delete(ctrl)
    }
  }

  // ── LLMProvider ───────────────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.send({ url: this.url('/models'), method: 'GET', headers: this.headers() }, AbortSignal.timeout(10_000))
      await collect(res.body)
      return res.status >= 200 && res.status < 300
    } catch {
      return false
    }
  }

  async *generate(messages: Msg[], opts: GenOpts): AsyncIterable<string> {
    const ctrl = this.track()
    this.usage = null
    try {
      const res = await this.post('/chat/completions', (f) => buildBody(this.config.model, messages, opts, f, { stream: true }), ctrl.signal)
      // Keep the raw text in case the server ignored `stream` and sent plain JSON.
      let raw = ''
      let sawEvent = false
      async function* tee(): AsyncIterable<string> {
        for await (const chunk of res.body) {
          if (!sawEvent && raw.length < 1_000_000) raw += chunk
          yield chunk
        }
      }
      for await (const data of parseSSE(tee())) {
        sawEvent = true
        const delta = parseStreamEvent(data)
        if (delta.usage) this.usage = delta.usage
        if (delta.done) break
        if (delta.content) yield delta.content
      }
      if (!sawEvent && raw.trim()) {
        const completion = parseCompletion(raw)
        this.usage = completion.usage
        if (completion.content) yield completion.content
      }
    } catch (err) {
      const e = this.toProviderError(err, ctrl.signal)
      if (e.kind === 'aborted') return // Stop ends generation quietly
      throw e
    } finally {
      this.controllers.delete(ctrl)
    }
  }

  async generateJSON<T>(messages: Msg[], schema: JSONSchema, opts: GenOpts): Promise<T> {
    let convo = withSystem(messages, jsonInstruction(schema))
    let errors: string[] = []
    for (let attempt = 0; attempt < 2; attempt++) {
      const { content } = await this.complete(convo, opts, { schema })
      try {
        const value = extractJSON(content)
        const result = validateJSON(value, schema)
        if (result.ok) return value as T
        errors = result.errors
      } catch (err) {
        errors = [(err as Error).message]
      }
      convo = [...convo, { role: 'assistant', content }, { role: 'user', content: jsonRetryMessage(errors) }]
    }
    throw new ProviderError('invalid_output', `${this.config.name} returned output that doesn't match the expected format: ${errors.slice(0, 3).join('; ')}`)
  }

  async callTools(messages: Msg[], tools: ToolDef[], opts: GenOpts): Promise<ToolCall[]> {
    if (tools.length > MAX_TOOLS_PER_CALL) {
      throw new ProviderError('config', `At most ${MAX_TOOLS_PER_CALL} tools per call (got ${tools.length})`)
    }
    let convo = messages
    let errors: string[] = []
    for (let attempt = 0; attempt < 2; attempt++) {
      const { raw, content } = await this.proposeCalls(convo, tools, opts)
      const result = validateToolCalls(raw, tools)
      if (result.errors.length === 0) return result.calls
      errors = result.errors
      convo = [...convo, { role: 'assistant', content: content || JSON.stringify(raw) }, { role: 'user', content: jsonRetryMessage(errors) }]
    }
    throw new ProviderError('invalid_output', `${this.config.name} proposed invalid tool calls: ${errors.slice(0, 3).join('; ')}`)
  }

  private async proposeCalls(messages: Msg[], tools: ToolDef[], opts: GenOpts): Promise<{ raw: RawToolCall[]; content: string }> {
    if (this.flags.nativeTools) {
      try {
        const completion = await this.complete(messages, opts, { tools })
        return { raw: completion.toolCalls, content: completion.content }
      } catch (err) {
        if (!(err instanceof ToolsRejected)) throw err
      }
    }
    const fallback = await this.generateJSON<{ tool_calls: Array<{ name: string; arguments: unknown }> }>(
      withSystem(messages, toolFallbackInstruction(tools)), toolFallbackSchema(tools), opts,
    )
    return {
      raw: fallback.tool_calls.map((c, i) => ({ id: `call_${i}`, name: c.name, arguments: c.arguments })),
      content: JSON.stringify(fallback),
    }
  }

  abort(): void {
    for (const ctrl of this.controllers) ctrl.abort()
    this.controllers.clear()
  }

  lastUsage(): TokenUsage | null {
    return this.usage
  }

  // ── settings helpers ──────────────────────────────────────────────────────

  /** Model ids from GET /models; empty if the server doesn't list them. */
  async listModels(): Promise<string[]> {
    const signal = AbortSignal.timeout(TEST_TIMEOUT_MS)
    const res = await this.send({ url: this.url('/models'), method: 'GET', headers: this.headers() }, signal)
    const text = await collect(res.body)
    if (res.status === 401 || res.status === 403) throw errorForStatus(res.status, text, this.config.name)
    if (res.status < 200 || res.status >= 300) return []
    try { return parseModelList(text) } catch { return [] }
  }

  /** Lists models, then makes a tiny real completion with the configured model. */
  async testConnection(): Promise<{ models: string[] }> {
    const models = await this.listModels()
    await this.complete(
      [{ role: 'user', content: 'Reply with OK.' }],
      { maxTokens: 16, temperature: 0, thinking: false },
      {},
      AbortSignal.timeout(TEST_TIMEOUT_MS),
    )
    return { models }
  }
}
