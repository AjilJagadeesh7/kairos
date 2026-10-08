import { describe, it, expect } from 'vitest'
import { parseSSE } from './sse'

async function events(chunks: string[]): Promise<string[]> {
  async function* src() { for (const c of chunks) yield c }
  const out: string[] = []
  for await (const e of parseSSE(src())) out.push(e)
  return out
}

describe('parseSSE', () => {
  it('yields data payloads of complete events', async () => {
    expect(await events(['data: a\n\ndata: b\n\n'])).toEqual(['a', 'b'])
  })

  it('reassembles events split at any byte', async () => {
    const stream = 'data: {"x":1}\n\ndata: {"y":2}\n\ndata: [DONE]\n\n'
    for (let size = 1; size <= 5; size++) {
      const chunks: string[] = []
      for (let i = 0; i < stream.length; i += size) chunks.push(stream.slice(i, i + size))
      expect(await events(chunks)).toEqual(['{"x":1}', '{"y":2}', '[DONE]'])
    }
  })

  it('handles CRLF split between chunks', async () => {
    expect(await events(['data: a\r', '\n\r', '\ndata: b\r\n\r\n'])).toEqual(['a', 'b'])
  })

  it('joins multi-line data and ignores comments and other fields', async () => {
    expect(await events([': ping\nevent: message\nid: 4\ndata: one\ndata: two\n\n'])).toEqual(['one\ntwo'])
  })

  it('flushes a final event without a trailing blank line', async () => {
    expect(await events(['data: last'])).toEqual(['last'])
  })
})
