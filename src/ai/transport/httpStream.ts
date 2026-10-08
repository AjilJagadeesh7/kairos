/**
 * Streaming HTTP for AI providers, routed through the native layer (PRD:
 * "requests executed through native HTTP") so there is no CORS and no Kairos
 * proxy in between.
 *
 *  - Desktop (Tauri): `ai_http_stream` Rust command, chunks over a Channel.
 *  - Android (Capacitor): local `AiHttp` plugin, chunks as plugin events. On a
 *    native shell that predates the plugin, falls back to `CapacitorHttp`
 *    (works, but the body arrives in one piece — no token streaming).
 *  - Browser dev server: plain `fetch` (subject to the server's CORS policy).
 */
import { isDesktop, isMobile } from '../../utils/platform'
import { checkProviderUrl } from '../net/urlPolicy'
import { createAsyncQueue } from './asyncQueue'

export interface StreamRequest {
  url: string
  method: 'GET' | 'POST'
  headers: Record<string, string>
  body?: string
}

export interface StreamResponse {
  status: number
  /** UTF-8 text chunks as they arrive. Iterate once. */
  body: AsyncIterable<string>
}

export class AbortedError extends Error {
  constructor() { super('Request aborted'); this.name = 'AbortedError' }
}

/** Native transport event — same shape from Rust and from the Android plugin. */
export type NativeHttpEvent =
  | { type: 'head'; status: number }
  | { type: 'chunk'; data: string }
  | { type: 'end' }
  | { type: 'error'; message: string }

let seq = 0
const nextId = () => `ai-${Date.now().toString(36)}-${(seq++).toString(36)}`

/**
 * Feeds native events into a StreamResponse. Resolves on `head`, rejects on an
 * error before `head`; later errors surface while iterating the body.
 */
function bridge(
  start: (onEvent: (e: NativeHttpEvent) => void) => Promise<void>,
  abort: () => void,
  signal?: AbortSignal,
): Promise<StreamResponse> {
  return new Promise<StreamResponse>((resolve, reject) => {
    const queue = createAsyncQueue<string>()
    let headed = false

    const onAbort = () => {
      abort()
      const err = new AbortedError()
      if (headed) queue.fail(err); else reject(err)
    }
    if (signal?.aborted) return reject(new AbortedError())
    signal?.addEventListener('abort', onAbort, { once: true })
    const cleanup = () => signal?.removeEventListener('abort', onAbort)

    start((e) => {
      switch (e.type) {
        case 'head':
          headed = true
          resolve({ status: e.status, body: queue })
          break
        case 'chunk':
          queue.push(e.data)
          break
        case 'end':
          cleanup()
          queue.close()
          break
        case 'error':
          cleanup()
          if (headed) queue.fail(new Error(e.message)); else reject(new Error(e.message))
          break
      }
    }).catch((err) => { cleanup(); reject(err) })
  })
}

async function tauriStream(req: StreamRequest, signal?: AbortSignal): Promise<StreamResponse> {
  const { invoke, Channel } = await import('@tauri-apps/api/core')
  const id = nextId()
  return bridge(
    async (onEvent) => {
      const channel = new Channel<NativeHttpEvent>()
      channel.onmessage = onEvent
      await invoke('ai_http_stream', { request: { id, ...req }, onEvent: channel })
    },
    () => { void invoke('ai_http_abort', { id }) },
    signal,
  )
}

async function capacitorStream(req: StreamRequest, signal?: AbortSignal): Promise<StreamResponse> {
  const { AiHttp } = await import('./aiHttpPlugin')
  const id = nextId()
  try {
    return await bridge(
      async (onEvent) => {
        const handle = await AiHttp.addListener('event', (e) => {
          if (e.id !== id) return
          onEvent(e)
          if (e.type === 'end' || e.type === 'error') void handle.remove()
        })
        await AiHttp.start({ id, ...req })
      },
      () => { void AiHttp.abort({ id }) },
      signal,
    )
  } catch (err) {
    if (!isUnimplemented(err)) throw err
    return capacitorBuffered(req, signal)
  }
}

function isUnimplemented(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code
  return code === 'UNIMPLEMENTED' || /not implemented/i.test(String((err as Error)?.message ?? ''))
}

/** Older native shells without the AiHttp plugin: whole body, one chunk. */
async function capacitorBuffered(req: StreamRequest, signal?: AbortSignal): Promise<StreamResponse> {
  const { CapacitorHttp } = await import('@capacitor/core')
  const res = await CapacitorHttp.request({
    url: req.url, method: req.method, headers: req.headers, data: req.body, responseType: 'text',
  })
  if (signal?.aborted) throw new AbortedError()
  const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '')
  const queue = createAsyncQueue<string>()
  queue.push(text)
  queue.close()
  return { status: res.status, body: queue }
}

/** Plain `fetch` streaming (browser dev, and Node for the eval script). */
export async function fetchStream(req: StreamRequest, signal?: AbortSignal): Promise<StreamResponse> {
  let res: Response
  try {
    res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body, signal })
  } catch (err) {
    if (signal?.aborted) throw new AbortedError()
    throw err
  }
  async function* chunks(): AsyncIterable<string> {
    if (!res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        if (text) yield text
      }
      const tail = decoder.decode()
      if (tail) yield tail
    } catch (err) {
      if (signal?.aborted) throw new AbortedError()
      throw err
    }
  }
  return { status: res.status, body: chunks() }
}

/** Sends a request after checking the URL policy (HTTPS unless local/LAN). */
export async function streamHttp(req: StreamRequest, signal?: AbortSignal): Promise<StreamResponse> {
  const policy = checkProviderUrl(req.url)
  if (!policy.ok) throw new Error(policy.reason)
  if (isDesktop()) return tauriStream(req, signal)
  if (isMobile()) return capacitorStream(req, signal)
  return fetchStream(req, signal)
}

/** Convenience for non-streaming calls: collects the whole body. */
export async function requestText(req: StreamRequest, signal?: AbortSignal): Promise<{ status: number; text: string }> {
  const res = await streamHttp(req, signal)
  let text = ''
  for await (const chunk of res.body) text += chunk
  return { status: res.status, text }
}
