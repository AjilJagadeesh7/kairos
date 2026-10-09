/**
 * Adapter for any OpenAI Chat Completions server: Ollama, LM Studio,
 * llama-server, vLLM, OpenRouter, Groq, Mistral, Together, OpenAI itself.
 * Feature logic lives elsewhere — this file only speaks the wire protocol.
 */
import { parseSSE } from '../transport/sse'
import { ProviderError, errorForStatus } from './errors'
import { HttpProvider, collect, type Adaptation, type CompleteExtras, type Completion, type Transport } from './httpProvider'
import {
  DEFAULT_FLAGS, adaptToRejection, buildBody, parseCompletion, parseEmbeddings, parseModelList, parseStreamEvent,
  type CompatFlags,
} from './openaiCompatWire'
import type { AiProviderConfig, GenOpts, Msg } from '../../types'

export type { Transport } from './httpProvider'

export class OpenAICompatProvider extends HttpProvider {
  readonly id = 'openai-compat' as const
  private flags: CompatFlags = { ...DEFAULT_FLAGS }

  constructor(config: AiProviderConfig, apiKey: string | null, transport?: Transport) {
    super(config, apiKey, transport, { embeddings: true })
  }

  protected headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`
    return h
  }

  protected nativeToolsEnabled(): boolean {
    return this.flags.nativeTools
  }

  /** A 400 naming an optional parameter flips its flag; `tools` flips to the JSON fallback. */
  private adapt = (status: number, message: string, body: Record<string, unknown>): Adaptation => {
    const adapted = adaptToRejection(status, message, this.flags, body)
    if (!adapted) return null
    const toolsRejected = this.flags.nativeTools && !adapted.nativeTools
    this.flags = adapted
    return toolsRejected ? 'tools-rejected' : 'retry'
  }

  protected async request(messages: Msg[], opts: GenOpts, extras: CompleteExtras, signal: AbortSignal): Promise<Completion> {
    const res = await this.post('/chat/completions', () => buildBody(this.config.model, messages, opts, this.flags, extras), signal, this.adapt)
    const text = await collect(res.body)
    try { return parseCompletion(text) } catch {
      throw new ProviderError('bad_request', `${this.config.name} sent a response that isn't a chat completion`)
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { status } = await this.getJSON('/models', AbortSignal.timeout(10_000))
      return status >= 200 && status < 300
    } catch {
      return false
    }
  }

  async *generate(messages: Msg[], opts: GenOpts): AsyncIterable<string> {
    const ctrl = this.track()
    this.usage = null
    try {
      const res = await this.post('/chat/completions', () => buildBody(this.config.model, messages, opts, this.flags, { stream: true }), ctrl.signal, this.adapt)
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
      this.endStream(ctrl)
    }
  }

  /** Model ids from GET /models; empty if the server doesn't list them. */
  async listModels(): Promise<string[]> {
    const { status, text } = await this.getJSON('/models', AbortSignal.timeout(30_000))
    if (status === 401 || status === 403) throw errorForStatus(status, text, this.config.name)
    if (status < 200 || status >= 300) return []
    try { return parseModelList(text) } catch { return [] }
  }

  /** POST /embeddings (OpenAI, Ollama, LM Studio, vLLM…). One vector per text, in order. */
  async embed(texts: string[], model: string, _task?: 'document' | 'query'): Promise<number[][]> {
    const ctrl = this.track()
    try {
      const res = await this.post('/embeddings', () => ({ model, input: texts }), ctrl.signal)
      const vectors = parseEmbeddings(await collect(res.body, 50_000_000))
      if (vectors.length !== texts.length) throw this.malformed()
      return vectors
    } catch (err) {
      throw this.toProviderError(err, ctrl.signal)
    } finally {
      this.untrack(ctrl)
    }
  }
}
