/**
 * Adapter for Google Gemini (Gemini API, v1beta): native function calling,
 * JSON schema output, streaming, and embeddings. Feature logic lives
 * elsewhere — this file only speaks the wire protocol.
 */
import { parseSSE } from '../transport/sse'
import { ProviderError, errorForStatus } from './errors'
import { HttpProvider, collect, type Adaptation, type CompleteExtras, type Completion, type Transport } from './httpProvider'
import {
  DEFAULT_GEMINI_FLAGS, adaptGemini, buildEmbedBody, buildGeminiBody, modelPath, parseEmbedResponse,
  parseGeminiModels, parseGeminiResponse, type GeminiFlags,
} from './geminiWire'
import type { AiProviderConfig, GenOpts, Msg } from '../../types'

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
/** batchEmbedContents takes at most 100 requests. */
const EMBED_BATCH = 100

export class GeminiProvider extends HttpProvider {
  readonly id = 'gemini' as const
  private flags: GeminiFlags = { ...DEFAULT_GEMINI_FLAGS }

  constructor(config: AiProviderConfig, apiKey: string | null, transport?: Transport) {
    super(config, apiKey, transport, { embeddings: true })
  }

  protected headers(): Record<string, string> {
    return { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'x-goog-api-key': this.apiKey ?? '' }
  }

  protected nativeToolsEnabled(): boolean {
    return this.flags.nativeTools
  }

  private adapt = (_status: number, message: string, body: Record<string, unknown>): Adaptation => {
    const adapted = adaptGemini(message, this.flags, body)
    if (!adapted) return null
    const toolsRejected = this.flags.nativeTools && !adapted.nativeTools
    this.flags = adapted
    return toolsRejected ? 'tools-rejected' : 'retry'
  }

  private blocked(reason: string): ProviderError {
    return new ProviderError('bad_request', `${this.config.name} blocked this request (${reason})`)
  }

  protected async request(messages: Msg[], opts: GenOpts, extras: CompleteExtras, signal: AbortSignal): Promise<Completion> {
    const path = `${modelPath(this.config.model)}:generateContent`
    const res = await this.post(path, () => buildGeminiBody(messages, opts, this.flags, extras), signal, this.adapt)
    let parsed: ReturnType<typeof parseGeminiResponse>
    try { parsed = parseGeminiResponse(await collect(res.body)) } catch { throw this.malformed() }
    if (parsed.blocked) throw this.blocked(parsed.blocked)
    return parsed
  }

  async *generate(messages: Msg[], opts: GenOpts): AsyncIterable<string> {
    const ctrl = this.track()
    this.usage = null
    try {
      const path = `${modelPath(this.config.model)}:streamGenerateContent?alt=sse`
      const res = await this.post(path, () => buildGeminiBody(messages, opts, this.flags), ctrl.signal, this.adapt)
      for await (const data of parseSSE(res.body)) {
        const chunk = parseGeminiResponse(data)
        if (chunk.blocked) throw this.blocked(chunk.blocked)
        if (chunk.usage) this.usage = chunk.usage
        if (chunk.content) yield chunk.content
      }
    } catch (err) {
      const e = this.toProviderError(err, ctrl.signal)
      if (e.kind === 'aborted') return // Stop ends generation quietly
      throw e
    } finally {
      this.endStream(ctrl)
    }
  }

  private async models(method: 'generateContent' | 'embedContent'): Promise<string[]> {
    const { status, text } = await this.getJSON('/models?pageSize=1000', AbortSignal.timeout(30_000))
    if (status < 200 || status >= 300) throw errorForStatus(status, text, this.config.name)
    try { return parseGeminiModels(text, method) } catch { return [] }
  }

  listModels(): Promise<string[]> {
    return this.models('generateContent')
  }

  listEmbeddingModels(): Promise<string[]> {
    return this.models('embedContent')
  }

  /** batchEmbedContents, 100 texts per request. One vector per text, in order. */
  async embed(texts: string[], model: string, task: 'document' | 'query' = 'document'): Promise<number[][]> {
    const ctrl = this.track()
    try {
      const out: number[][] = []
      for (let i = 0; i < texts.length; i += EMBED_BATCH) {
        const part = texts.slice(i, i + EMBED_BATCH)
        const res = await this.post(`${modelPath(model)}:batchEmbedContents`, () => buildEmbedBody(model, part, task), ctrl.signal)
        const vectors = parseEmbedResponse(await collect(res.body, 50_000_000))
        if (vectors.length !== part.length) throw this.malformed()
        out.push(...vectors)
      }
      return out
    } catch (err) {
      throw this.toProviderError(err, ctrl.signal)
    } finally {
      this.untrack(ctrl)
    }
  }
}
