/**
 * The on-device provider (PRD `capacitor-llama` / `tauri-llama`): MiniCPM5
 * through llama.cpp, no network. Loaded lazily on first use and unloaded
 * after 5 idle minutes. JSON is grammar-constrained (GBNF from the schema);
 * tool calls use the validated-JSON form, since the model has no native tool
 * format. Never generates while the app is in the background.
 */
import { createAsyncQueue } from '../transport/asyncQueue'
import { extractJSON, validateJSON } from '../json/validate'
import { jsonInstruction, jsonRetryMessage, toolFallbackInstruction } from '../prompts/jsonOutput.v1'
import { ProviderError } from '../providers/errors'
import { THINKING_HEADROOM, toolFallbackSchema, validateToolCalls } from '../providers/toolCalls'
import { withSystem } from '../providers/httpProvider'
import { stripThinking } from '../text/clean'
import { schemaToGbnf } from './gbnf'
import type {
  GenOpts, JSONSchema, LLMProvider, LocalGenerateRequest, LocalRuntime, Msg, ProviderCapabilities, TokenUsage, ToolCall, ToolDef,
} from '../../types'

export const IDLE_UNLOAD_MS = 5 * 60_000

export interface OnDeviceOptions {
  modelPath: string
  contextTokens: number
  /** 'tauri-llama' on desktop, 'capacitor-llama' on Android. */
  id: 'tauri-llama' | 'capacitor-llama'
  /** True while the app is in the background (Android): generation is refused or stopped. */
  isBackground?: () => boolean
}

const toWire = (messages: Msg[]): LocalGenerateRequest['messages'] =>
  messages.map((m) => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content }))

export class OnDeviceProvider implements LLMProvider {
  readonly id: OnDeviceOptions['id']
  readonly capabilities: ProviderCapabilities
  private loaded = false
  private idle: ReturnType<typeof setTimeout> | null = null
  private usage: TokenUsage | null = null
  private busy = false
  onUsage: ((u: TokenUsage) => void) | null = null

  private readonly runtime: LocalRuntime
  private readonly opts: OnDeviceOptions

  constructor(runtime: LocalRuntime, opts: OnDeviceOptions) {
    this.runtime = runtime
    this.opts = opts
    this.id = opts.id
    this.capabilities = { nativeTools: false, jsonSchema: true, contextTokens: opts.contextTokens, embeddings: false, location: 'on-device' }
  }

  async isAvailable(): Promise<boolean> {
    return this.runtime.available()
  }

  /** Loads on first use (PRD: lazily). */
  private async ensureLoaded(): Promise<void> {
    if (this.idle) { clearTimeout(this.idle); this.idle = null }
    if (this.loaded) return
    if (!(await this.runtime.available())) throw new ProviderError('config', 'The on-device runtime isn\'t part of this build')
    await this.runtime.load(this.opts.modelPath, this.opts.contextTokens)
    this.loaded = true
  }

  /** Unload after 5 idle minutes (PRD). */
  private scheduleUnload(): void {
    if (this.idle) clearTimeout(this.idle)
    this.idle = setTimeout(() => { void this.unload() }, IDLE_UNLOAD_MS)
  }

  async load(): Promise<void> { await this.ensureLoaded() }

  async unload(): Promise<void> {
    if (this.idle) { clearTimeout(this.idle); this.idle = null }
    if (!this.loaded) return
    this.loaded = false
    await this.runtime.unload()
  }

  async *generate(messages: Msg[], opts: GenOpts, grammar?: string): AsyncIterable<string> {
    if (this.opts.isBackground?.()) throw new ProviderError('aborted', 'Paused while Kairos is in the background')
    await this.ensureLoaded()
    const queue = createAsyncQueue<string>()
    this.usage = null
    this.busy = true
    // Going to the background stops generation (PRD: never infer while backgrounded).
    const onHide = () => { if (this.opts.isBackground?.()) void this.runtime.abort() }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHide)
    const done = this.runtime.generate({
      messages: toWire(messages),
      // Reasoning models think inside the same token budget.
      maxTokens: opts.maxTokens + (opts.thinking ? THINKING_HEADROOM : 0),
      temperature: opts.temperature,
      stop: opts.stop,
      grammar,
      thinking: opts.thinking,
    }, (e) => {
      if (e.type === 'token') queue.push(e.text)
      else if (e.type === 'done') this.usage = { promptTokens: e.promptTokens, completionTokens: e.completionTokens }
    }).then(() => queue.close(), (err) => queue.fail(new ProviderError('server', `On-device model failed: ${(err as Error).message}`)))
    try {
      for await (const t of queue) yield t
      await done
      if (this.usage) this.onUsage?.(this.usage)
    } finally {
      this.busy = false
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHide)
      this.scheduleUnload()
    }
  }

  private async complete(messages: Msg[], opts: GenOpts, grammar?: string): Promise<string> {
    let text = ''
    for await (const t of this.generate(messages, opts, grammar)) text += t
    return stripThinking(text)
  }

  async generateJSON<T>(messages: Msg[], schema: JSONSchema, opts: GenOpts): Promise<T> {
    // Grammar-constrained decoding makes the JSON well-formed; the validator still checks bounds.
    const grammar = schemaToGbnf(schema)
    let convo = withSystem(messages, jsonInstruction(schema))
    let errors: string[] = []
    for (let attempt = 0; attempt < 2; attempt++) {
      const content = await this.complete(convo, { ...opts, thinking: false }, grammar)
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
    throw new ProviderError('invalid_output', `The on-device model returned output that doesn't match the expected format: ${errors.slice(0, 3).join('; ')}`)
  }

  async callTools(messages: Msg[], tools: ToolDef[], opts: GenOpts): Promise<ToolCall[]> {
    const out = await this.generateJSON<{ tool_calls: Array<{ name: string; arguments: unknown }> }>(
      withSystem(messages, toolFallbackInstruction(tools)), toolFallbackSchema(tools), opts,
    )
    const result = validateToolCalls(out.tool_calls.map((c, i) => ({ id: `call_${i}`, name: c.name, arguments: c.arguments })), tools)
    if (result.errors.length) throw new ProviderError('invalid_output', `The on-device model proposed invalid tool calls: ${result.errors.slice(0, 3).join('; ')}`)
    return result.calls
  }

  abort(): void {
    if (this.busy) void this.runtime.abort()
  }

  lastUsage(): TokenUsage | null {
    return this.usage
  }

  /** Android memory pressure (PRD): drop the model now. */
  onMemoryPressure(): void {
    void this.unload()
  }
}
