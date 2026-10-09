/** A fake transport for adapter tests: replies in order, records each request, splits bodies into small chunks. */
import type { Transport } from '../httpProvider'
import type { StreamRequest } from '../../transport/httpStream'

export type Reply = { status: number; body: string; chunkSize?: number }

export function fakeTransport(replies: Reply[]) {
  const requests: Array<StreamRequest & { json: Record<string, unknown> | null }> = []
  const transport: Transport = async (req) => {
    requests.push({ ...req, json: req.body ? JSON.parse(req.body) as Record<string, unknown> : null })
    const reply = replies.shift()
    if (!reply) throw new Error('unexpected request')
    const size = reply.chunkSize ?? 7
    async function* body() {
      for (let i = 0; i < reply!.body.length; i += size) yield reply!.body.slice(i, i + size)
    }
    return { status: reply.status, body: body() }
  }
  return { transport, requests }
}

export async function drain(it: AsyncIterable<string>): Promise<string> {
  let out = ''
  for await (const s of it) out += s
  return out
}

/** SSE frames from `{ event?, data }` pairs, the way servers send them. */
export function sse(events: Array<{ event?: string; data: unknown }>): string {
  return events.map((e) => `${e.event ? `event: ${e.event}\n` : ''}data: ${typeof e.data === 'string' ? e.data : JSON.stringify(e.data)}\n\n`).join('')
}
