/**
 * Adapter for Claude (Anthropic Messages API): native tool use, structured
 * outputs, streaming. Anthropic has no embeddings endpoint. Feature logic
 * lives elsewhere — this file only speaks the wire protocol.
 */
import { parseSSE } from '../transport/sse'
import { errorForStatus } from './errors'
import { HttpProvider, collect, type Adaptation, type CompleteExtras, type Completion, type Transport } from './httpProvider'
import {
  ANTHROPIC_VERSION, DEFAULT_ANTHROPIC_FLAGS, adaptAnthropic, buildAnthropicBody, parseAnthropicEvent,
  parseAnthropicMessage, parseAnthropicModels, type AnthropicFlags,
} from './anthropicWire'
import type { AiProviderConfig, GenOpts, Msg } from '../../types'

export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1'

export class AnthropicProvider extends HttpProvider {
  readonly id = 'anthropic' as const
  private flags: AnthropicFlags = { ...DEFAULT_ANTHROPIC_FLAGS }

  constructor(config: AiProviderConfig, apiKey: string | null, transport?: Transport) {
    super(config, apiKey, transport, { embeddings: false })
  }

  protected headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'x-api-key': this.apiKey ?? '',
      'anthropic-version': ANTHROPIC_VERSION,
      // Requests go out through the native layer; this only matters for the browser dev server (CORS).
      'anthropic-dangerous-direct-browser-access': 'true',
    }
  }

  protected nativeToolsEnabled(): boolean {
    return this.flags.nativeTools
  }

  private adapt = (_status: number, message: string, body: Record<string, unknown>): Adaptation => {
    const adapted = adaptAnthropic(message, this.flags, body)
    if (!adapted) return null
    const toolsRejected = this.flags.nativeTools && !adapted.nativeTools
    this.flags = adapted
    return toolsRejected ? 'tools-rejected' : 'retry'
  }

  protected async request(messages: Msg[], opts: GenOpts, extras: CompleteExtras, signal: AbortSignal): Promise<Completion> {
    const res = await this.post('/messages', () => buildAnthropicBody(this.config.model, messages, opts, this.flags, extras), signal, this.adapt)
    try { return parseAnthropicMessage(await collect(res.body)) } catch { throw this.malformed() }
  }

  async *generate(messages: Msg[], opts: GenOpts): AsyncIterable<string> {
    const ctrl = this.track()
    this.usage = null
    try {
      const res = await this.post('/messages', () => buildAnthropicBody(this.config.model, messages, opts, this.flags, { stream: true }), ctrl.signal, this.adapt)
      let input = 0
      for await (const data of parseSSE(res.body)) {
        const d = parseAnthropicEvent(data)
        if (d.inputTokens !== undefined) input = d.inputTokens
        if (d.outputTokens !== undefined) this.usage = { promptTokens: input, completionTokens: d.outputTokens }
        if (d.done) break
        if (d.text) yield d.text
      }
    } catch (err) {
      const e = this.toProviderError(err, ctrl.signal)
      if (e.kind === 'aborted') return // Stop ends generation quietly
      throw e
    } finally {
      this.endStream(ctrl)
    }
  }

  async listModels(): Promise<string[]> {
    const { status, text } = await this.getJSON('/models?limit=100', AbortSignal.timeout(30_000))
    if (status < 200 || status >= 300) throw errorForStatus(status, text, this.config.name)
    try { return parseAnthropicModels(text) } catch { return [] }
  }
}
