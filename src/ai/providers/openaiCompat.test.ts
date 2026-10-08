import { describe, it, expect } from 'vitest'
import { OpenAICompatProvider, type Transport } from './openaiCompat'
import { ProviderError } from './errors'
import { createAsyncQueue } from '../transport/asyncQueue'
import { AbortedError, type StreamRequest } from '../transport/httpStream'
import * as fx from './__fixtures__/openaiCompat.fixtures'
import type { AiProviderConfig, GenOpts, JSONSchema, ToolDef } from '../../types'

const config: AiProviderConfig = {
  id: 'p1', type: 'openai-compat', name: 'Ollama', baseUrl: 'http://localhost:11434/v1/',
  model: 'qwen3:4b', verified: true, contextTokens: 8192, createdAt: '2026-10-08T00:00:00Z',
}
const opts: GenOpts = { maxTokens: 256, temperature: 0.2, thinking: false }

type Reply = { status: number; body: string; chunkSize?: number }

/** Fake transport: replies in order, records each request. Bodies are split
 *  into small chunks to exercise the incremental parsers. */
function fakeTransport(replies: Reply[]) {
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

async function collectStream(it: AsyncIterable<string>): Promise<string> {
  let out = ''
  for await (const s of it) out += s
  return out
}

const moveCard: ToolDef = {
  name: 'move_card',
  description: 'Move a card to another column',
  parameters: {
    type: 'object',
    properties: { cardId: { type: 'string' }, toColumn: { type: 'string' } },
    required: ['cardId', 'toColumn'],
    additionalProperties: false,
  },
}

describe('OpenAICompatProvider.generate', () => {
  it('streams deltas, records usage, and sends the expected request', async () => {
    const { transport, requests } = fakeTransport([{ status: 200, body: fx.STREAM_HELLO }])
    const p = new OpenAICompatProvider(config, 'sk-test', transport)
    const text = await collectStream(p.generate([{ role: 'user', content: 'hi' }], opts))

    expect(text).toBe('Hello, wörld')
    expect(p.lastUsage()).toEqual({ promptTokens: 12, completionTokens: 3 })
    expect(requests[0].url).toBe('http://localhost:11434/v1/chat/completions')
    expect(requests[0].headers.Authorization).toBe('Bearer sk-test')
    expect(requests[0].json).toMatchObject({
      model: 'qwen3:4b', stream: true, stream_options: { include_usage: true }, max_tokens: 256, temperature: 0.2,
    })
  })

  it('omits Authorization without a key', async () => {
    const { transport, requests } = fakeTransport([{ status: 200, body: fx.STREAM_HELLO }])
    await collectStream(new OpenAICompatProvider(config, null, transport).generate([{ role: 'user', content: 'hi' }], opts))
    expect(requests[0].headers.Authorization).toBeUndefined()
  })

  it('handles a server that ignores stream:true and returns one JSON body', async () => {
    const { transport } = fakeTransport([{ status: 200, body: fx.completion('Plain answer') }])
    const p = new OpenAICompatProvider(config, null, transport)
    expect(await collectStream(p.generate([{ role: 'user', content: 'hi' }], opts))).toBe('Plain answer')
  })

  it('switches to max_completion_tokens when the server rejects max_tokens', async () => {
    const { transport, requests } = fakeTransport([
      { status: 400, body: fx.ERR_MAX_TOKENS },
      { status: 200, body: fx.STREAM_HELLO },
    ])
    const p = new OpenAICompatProvider(config, 'k', transport)
    expect(await collectStream(p.generate([{ role: 'user', content: 'hi' }], opts))).toBe('Hello, wörld')
    expect(requests[1].json).toMatchObject({ max_completion_tokens: 256 })
    expect(requests[1].json).not.toHaveProperty('max_tokens')
  })

  it('maps auth and quota errors', async () => {
    const auth = new OpenAICompatProvider(config, 'bad', fakeTransport([{ status: 401, body: fx.ERR_BAD_KEY }]).transport)
    await expect(collectStream(auth.generate([{ role: 'user', content: 'hi' }], opts)))
      .rejects.toMatchObject({ kind: 'auth', status: 401 })

    const quota = new OpenAICompatProvider(config, 'k', fakeTransport([{ status: 429, body: fx.ERR_QUOTA }]).transport)
    await expect(collectStream(quota.generate([{ role: 'user', content: 'hi' }], opts)))
      .rejects.toMatchObject({ kind: 'quota' })
  })

  it('maps transport failures to network errors', async () => {
    const p = new OpenAICompatProvider(config, null, async () => { throw new Error('connection refused') })
    await expect(collectStream(p.generate([{ role: 'user', content: 'hi' }], opts)))
      .rejects.toMatchObject({ kind: 'network' })
  })

  it('abort() ends the stream quietly and promptly', async () => {
    const queue = createAsyncQueue<string>()
    const transport: Transport = async (_req, signal) => {
      signal?.addEventListener('abort', () => queue.fail(new AbortedError()))
      return { status: 200, body: queue }
    }
    const p = new OpenAICompatProvider(config, null, transport)
    const received: string[] = []
    const done = (async () => { for await (const t of p.generate([{ role: 'user', content: 'hi' }], opts)) received.push(t) })()

    queue.push(fx.STREAM_HELLO.split('\n\n')[0] + '\n\n')
    await new Promise((r) => setTimeout(r, 10))
    const t0 = Date.now()
    p.abort()
    await done
    expect(Date.now() - t0).toBeLessThan(500)
    expect(received).toEqual(['Hel'])
  })
})

describe('OpenAICompatProvider.generateJSON', () => {
  const schema: JSONSchema = {
    type: 'object',
    properties: { title: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
    required: ['title', 'tags'],
    additionalProperties: false,
  }

  it('requests json_schema output and returns the parsed value', async () => {
    const { transport, requests } = fakeTransport([{ status: 200, body: fx.completion('{"title":"Plan","tags":["q4"]}') }])
    const p = new OpenAICompatProvider(config, null, transport)
    expect(await p.generateJSON([{ role: 'user', content: 'x' }], schema, opts)).toEqual({ title: 'Plan', tags: ['q4'] })
    expect(requests[0].json?.response_format).toMatchObject({ type: 'json_schema' })
    const system = (requests[0].json?.messages as Array<{ role: string; content: string }>)[0]
    expect(system.role).toBe('system')
    expect(system.content).toContain('"required":["title","tags"]')
  })

  it('retries once with the validation errors appended', async () => {
    const { transport, requests } = fakeTransport([
      { status: 200, body: fx.completion('{"title":"Plan"}') },
      { status: 200, body: fx.completion('```json\n{"title":"Plan","tags":[]}\n```') },
    ])
    const p = new OpenAICompatProvider(config, null, transport)
    expect(await p.generateJSON([{ role: 'user', content: 'x' }], schema, opts)).toEqual({ title: 'Plan', tags: [] })
    const retry = (requests[1].json?.messages as Array<{ role: string; content: string }>).at(-1)!
    expect(retry.content).toContain('tags: required')
  })

  it('gives up after one retry', async () => {
    const { transport } = fakeTransport([
      { status: 200, body: fx.completion('not json') },
      { status: 200, body: fx.completion('{"title":1,"tags":[]}') },
    ])
    const p = new OpenAICompatProvider(config, null, transport)
    await expect(p.generateJSON([{ role: 'user', content: 'x' }], schema, opts)).rejects.toMatchObject({ kind: 'invalid_output' })
  })

  it('falls back from json_schema to json_object when the server rejects it', async () => {
    const { transport, requests } = fakeTransport([
      { status: 400, body: JSON.stringify({ error: { message: "response_format type 'json_schema' is not supported" } }) },
      { status: 200, body: fx.completion('{"title":"A","tags":[]}') },
    ])
    const p = new OpenAICompatProvider(config, null, transport)
    await p.generateJSON([{ role: 'user', content: 'x' }], schema, opts)
    expect(requests[1].json?.response_format).toEqual({ type: 'json_object' })
  })
})

describe('OpenAICompatProvider.callTools', () => {
  it('parses native tool calls with string or object arguments', async () => {
    for (const body of [fx.TOOL_CALL_NATIVE, fx.TOOL_CALL_OBJECT_ARGS]) {
      const { transport, requests } = fakeTransport([{ status: 200, body }])
      const calls = await new OpenAICompatProvider(config, null, transport).callTools([{ role: 'user', content: 'x' }], [moveCard], opts)
      expect(calls).toEqual([expect.objectContaining({ name: 'move_card', args: { cardId: 'KAI-4', toColumn: 'Done' } })])
      expect(requests[0].json?.tools).toEqual([{ type: 'function', function: expect.objectContaining({ name: 'move_card' }) }])
    }
  })

  it('falls back to validated JSON when the model has no tool support', async () => {
    const { transport, requests } = fakeTransport([
      { status: 400, body: fx.ERR_TOOLS_UNSUPPORTED },
      { status: 200, body: fx.completion('{"tool_calls":[{"name":"move_card","arguments":{"cardId":"KAI-4","toColumn":"Done"}}]}') },
    ])
    const calls = await new OpenAICompatProvider(config, null, transport).callTools([{ role: 'user', content: 'x' }], [moveCard], opts)
    expect(calls).toEqual([expect.objectContaining({ name: 'move_card', args: { cardId: 'KAI-4', toColumn: 'Done' } })])
    expect(requests[1].json).not.toHaveProperty('tools')
  })

  it('retries once when a call fails its schema, then succeeds', async () => {
    const { transport, requests } = fakeTransport([
      { status: 200, body: fx.completion(null, { tool_calls: [{ id: 'a', function: { name: 'move_card', arguments: '{"cardId":"KAI-4"}' } }] }) },
      { status: 200, body: fx.TOOL_CALL_NATIVE },
    ])
    const calls = await new OpenAICompatProvider(config, null, transport).callTools([{ role: 'user', content: 'x' }], [moveCard], opts)
    expect(calls).toHaveLength(1)
    expect(JSON.stringify(requests[1].json?.messages)).toContain('toColumn: required')
  })

  it('refuses more than 10 tools', async () => {
    const tools = Array.from({ length: 11 }, (_, i) => ({ ...moveCard, name: `t${i}` }))
    const p = new OpenAICompatProvider(config, null, fakeTransport([]).transport)
    await expect(p.callTools([], tools, opts)).rejects.toBeInstanceOf(ProviderError)
  })
})

describe('OpenAICompatProvider.testConnection', () => {
  it('lists models and makes a tiny completion', async () => {
    const { transport, requests } = fakeTransport([
      { status: 200, body: fx.MODELS },
      { status: 200, body: fx.completion('OK') },
    ])
    const { models } = await new OpenAICompatProvider(config, null, transport).testConnection()
    expect(models).toEqual(['llama3.2:3b', 'qwen3:4b'])
    expect(requests[0]).toMatchObject({ method: 'GET', url: 'http://localhost:11434/v1/models' })
    expect(requests[1].json).toMatchObject({ model: 'qwen3:4b', max_tokens: 16 })
  })

  it('reports a rejected key from /models', async () => {
    const { transport } = fakeTransport([{ status: 401, body: fx.ERR_BAD_KEY }])
    await expect(new OpenAICompatProvider(config, 'bad', transport).testConnection()).rejects.toMatchObject({ kind: 'auth' })
  })
})
