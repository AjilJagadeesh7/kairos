/**
 * What every HTTP provider adapter shares: abort tracking, error mapping,
 * retrying when a server rejects an optional parameter, validated JSON with
 * one retry, and tool calls (native, or the schema-in-prompt JSON fallback).
 * Subclasses only speak their wire format. No feature logic here.
 */
import { streamHttp, AbortedError, type StreamRequest, type StreamResponse } from '../transport/httpStream'
import { extractJSON, validateJSON } from '../json/validate'
import { locationForUrl } from '../net/urlPolicy'
import { jsonInstruction, jsonRetryMessage, toolFallbackInstruction } from '../prompts/jsonOutput.v1'
import { ProviderError, errorForStatus, parseErrorBody } from './errors'
import { MAX_TOOLS_PER_CALL, toolFallbackSchema, validateToolCalls, type RawToolCall } from './toolCalls'
import type {
  AiProviderConfig, GenOpts, JSONSchema, LLMProvider, Msg, ProviderCapabilities, ProviderId, TokenUsage, ToolCall, ToolDef,
} from '../../types'

export type Transport = (req: StreamRequest, signal?: AbortSignal) => Promise<StreamResponse>

export interface Completion {
  content: string
  toolCalls: RawToolCall[]
  usage: TokenUsage | null
}

export interface CompleteExtras {
  schema?: JSONSchema
  tools?: ToolDef[]
}

/** How a subclass reacts to a 400 that may name an optional parameter. */
export type Adaptation = 'retry' | 'tools-rejected' | null

const MAX_ADAPTATIONS = 5
export const TEST_TIMEOUT_MS = 30_000

/** The server (or model) doesn't support native tools — use the JSON fallback. */
export class ToolsRejected extends ProviderError {
  constructor(name: string) { super('bad_request', `${name} doesn't support native tool calling`) }
}

export async function collect(body: AsyncIterable<string>, limit = 1_000_000): Promise<string> {
  let text = ''
  for await (const chunk of body) {
    text += chunk
    if (text.length > limit) break
  }
  return text
}

/** Adds an instruction to the system prompt (or creates one). */
export function withSystem(messages: Msg[], instruction: string): Msg[] {
  if (messages[0]?.role === 'system') {
    return [{ ...messages[0], content: `${messages[0].content}\n\n${instruction}` }, ...messages.slice(1)]
  }
  return [{ role: 'system', content: instruction }, ...messages]
}

export abstract class HttpProvider implements LLMProvider {
  abstract readonly id: ProviderId
  readonly capabilities: ProviderCapabilities
  protected usage: TokenUsage | null = null
  private readonly controllers = new Set<AbortController>()
  /** Called once per finished request with the usage the provider reported (token metering). */
  onUsage: ((usage: TokenUsage) => void) | null = null

  protected readonly config: AiProviderConfig
  protected readonly apiKey: string | null
  protected readonly transport: Transport

  constructor(config: AiProviderConfig, apiKey: string | null, transport: Transport = streamHttp, caps: { embeddings: boolean }) {
    this.config = config
    this.apiKey = apiKey
    this.transport = transport
    this.capabilities = {
      nativeTools: true,
      jsonSchema: true,
      contextTokens: config.contextTokens,
      embeddings: caps.embeddings,
      location: locationForUrl(config.baseUrl),
    }
  }

  // ── wire format (per subclass) ────────────────────────────────────────────

  protected abstract headers(): Record<string, string>
  /** One non-streaming request. Throws ToolsRejected when native tools aren't supported. */
  protected abstract request(messages: Msg[], opts: GenOpts, extras: CompleteExtras, signal: AbortSignal): Promise<Completion>
  /** Model ids for the settings picker; empty when the server doesn't list them. */
  abstract listModels(): Promise<string[]>
  abstract generate(messages: Msg[], opts: GenOpts): AsyncIterable<string>
  /** Whether the next tool call should try the native format. */
  protected abstract nativeToolsEnabled(): boolean

  // ── plumbing ──────────────────────────────────────────────────────────────

  protected url(path: string): string {
    return `${this.config.baseUrl.replace(/\/+$/, '')}${path}`
  }

  protected toProviderError(err: unknown, signal?: AbortSignal): ProviderError {
    if (err instanceof ProviderError) return err
    if ((signal?.reason as Error | undefined)?.name === 'TimeoutError') {
      return new ProviderError('network', `${this.config.name} didn't respond in time`)
    }
    if (err instanceof AbortedError || signal?.aborted) return new ProviderError('aborted', 'Stopped')
    const message = err instanceof Error ? err.message : String(err)
    return new ProviderError('network', `Couldn't reach ${this.config.name}: ${message}`)
  }

  protected async send(req: StreamRequest, signal: AbortSignal): Promise<StreamResponse> {
    try {
      return await this.transport(req, signal)
    } catch (err) {
      throw this.toProviderError(err, signal)
    }
  }

  protected async getJSON(path: string, signal: AbortSignal): Promise<{ status: number; text: string }> {
    const res = await this.send({ url: this.url(path), method: 'GET', headers: this.headers() }, signal)
    return { status: res.status, text: await collect(res.body) }
  }

  /**
   * POST, retrying when `adapt` says the server rejected an optional
   * parameter (it updates the subclass's flags, so `build` sends less).
   */
  protected async post(
    path: string, build: () => Record<string, unknown>, signal: AbortSignal,
    adapt: (status: number, message: string, body: Record<string, unknown>) => Adaptation = () => null,
  ): Promise<StreamResponse> {
    for (let i = 0; i <= MAX_ADAPTATIONS; i++) {
      const body = build()
      const res = await this.send({ url: this.url(path), method: 'POST', headers: this.headers(), body: JSON.stringify(body) }, signal)
      if (res.status >= 200 && res.status < 300) return res
      const text = await collect(res.body)
      const verdict = res.status === 400 || res.status === 422 ? adapt(res.status, parseErrorBody(text).message || text, body) : null
      if (!verdict) throw errorForStatus(res.status, text, this.config.name)
      // Resending without tools would be pointless — the caller switches to the JSON fallback.
      if (verdict === 'tools-rejected') throw new ToolsRejected(this.config.name)
    }
    throw new ProviderError('bad_request', `${this.config.name} kept rejecting the request parameters`)
  }

  protected track(): AbortController {
    const ctrl = new AbortController()
    this.controllers.add(ctrl)
    return ctrl
  }

  protected untrack(ctrl: AbortController): void {
    this.controllers.delete(ctrl)
  }

  /** End of a stream: report its usage once (stream chunks may repeat running totals). */
  protected endStream(ctrl: AbortController): void {
    this.untrack(ctrl)
    if (this.usage) this.onUsage?.(this.usage)
  }

  protected async complete(messages: Msg[], opts: GenOpts, extras: CompleteExtras = {}, signal?: AbortSignal): Promise<Completion> {
    const ctrl = this.track()
    const onOuterAbort = () => ctrl.abort(signal?.reason)
    signal?.addEventListener('abort', onOuterAbort, { once: true })
    try {
      const completion = await this.request(messages, opts, extras, ctrl.signal)
      this.usage = completion.usage
      if (completion.usage) this.onUsage?.(completion.usage)
      return completion
    } catch (err) {
      throw this.toProviderError(err, ctrl.signal)
    } finally {
      signal?.removeEventListener('abort', onOuterAbort)
      this.untrack(ctrl)
    }
  }

  /** Thrown when a response body isn't the provider's format. */
  protected malformed(): ProviderError {
    return new ProviderError('bad_request', `${this.config.name} sent a response that isn't a valid reply`)
  }

  // ── LLMProvider ───────────────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    try {
      await this.listModels()
      return true
    } catch {
      return false
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

  /** Native tool calls when the provider takes them; otherwise validated JSON (PRD). */
  private async proposeCalls(messages: Msg[], tools: ToolDef[], opts: GenOpts): Promise<{ raw: RawToolCall[]; content: string }> {
    if (this.nativeToolsEnabled()) {
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
