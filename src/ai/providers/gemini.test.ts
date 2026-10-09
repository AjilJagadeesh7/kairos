import { describe, expect, it } from 'vitest'
import { GeminiProvider } from './gemini'
import { OpenAICompatProvider } from './openaiCompat'
import { toGeminiContents } from './geminiWire'
import { drain, fakeTransport } from './__fixtures__/transport'
import * as fx from './__fixtures__/gemini.fixtures'
import type { AiProviderConfig, GenOpts, JSONSchema, TokenUsage, ToolDef } from '../../types'

const config: AiProviderConfig = {
  id: 'g1', type: 'gemini', name: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  model: 'gemini-2.5-flash', verified: true, contextTokens: 32000, createdAt: '2026-10-08T00:00:00Z',
}
const opts: GenOpts = { maxTokens: 256, temperature: 0.2, thinking: false }
const moveCard: ToolDef = {
  name: 'move_card', description: 'Move a card',
  parameters: { type: 'object', properties: { cardId: { type: 'string', minLength: 1 }, toColumn: { type: 'string' } }, required: ['cardId', 'toColumn'] },
}

function provider(replies: Parameters<typeof fakeTransport>[0]) {
  const t = fakeTransport(replies)
  const p = new GeminiProvider(config, 'AIza-test', t.transport)
  const usages: TokenUsage[] = []
  p.onUsage = (u) => usages.push(u)
  return { p, requests: t.requests, usages }
}

describe('GeminiProvider', () => {
  it('streams answer text (thoughts skipped) and counts the final usage once', async () => {
    const { p, requests, usages } = provider([{ status: 200, body: fx.textStream }])
    expect(await drain(p.generate([{ role: 'system', content: 'Be brief.' }, { role: 'user', content: 'Hi' }], opts))).toBe('Hello!')
    expect(usages).toEqual([{ promptTokens: 30, completionTokens: 7 }])
    const r = requests[0]
    expect(r.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse')
    expect(r.headers['x-goog-api-key']).toBe('AIza-test')
    expect(r.json).toEqual({
      systemInstruction: { parts: [{ text: 'Be brief.' }] },
      contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
      generationConfig: { maxOutputTokens: 256, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
    })
  })

  it('leaves thinking to the model when asked for it, with headroom', async () => {
    const { p, requests } = provider([{ status: 200, body: fx.functionCallResponse }])
    await p.callTools([{ role: 'user', content: 'Move' }], [moveCard], { ...opts, thinking: true })
    const gen = requests[0].json!.generationConfig as Record<string, unknown>
    expect(gen.thinkingConfig).toBeUndefined()
    expect(gen.maxOutputTokens).toBe(256 + 4096)
  })

  it('declares tools as functionDeclarations and reads functionCall parts', async () => {
    const { p, requests } = provider([{ status: 200, body: fx.functionCallResponse }])
    const calls = await p.callTools([{ role: 'user', content: 'Move them' }], [moveCard], opts)
    expect(calls).toEqual([
      { id: 'call_0', name: 'move_card', args: { cardId: 'KAI-4', toColumn: 'Done' } },
      { id: 'fc_2', name: 'move_card', args: { cardId: 'KAI-2', toColumn: 'Done' } },
    ])
    expect(requests[0].url).toMatch(/:generateContent$/)
    expect(requests[0].json!.tools).toEqual([{ functionDeclarations: [{ name: 'move_card', description: 'Move a card', parametersJsonSchema: moveCard.parameters }] }])
  })

  it('asks for JSON with responseJsonSchema', async () => {
    const schema: JSONSchema = { type: 'object', properties: { intent: { type: 'string', enum: ['question'], minLength: 1 } }, required: ['intent'] }
    const { p, requests } = provider([{ status: 200, body: fx.jsonResponse }])
    expect(await p.generateJSON([{ role: 'user', content: 'x' }], schema, opts)).toEqual({ intent: 'question' })
    expect(requests[0].json!.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object', properties: { intent: { type: 'string', enum: ['question'] } }, required: ['intent'] },
    })
  })

  it('stops sending thinkingBudget when a model refuses it', async () => {
    const q = provider([{ status: 400, body: fx.thinkingRejected }, { status: 200, body: fx.textStream }])
    expect(await drain(q.p.generate([{ role: 'user', content: 'x' }], opts))).toBe('Hello!')
    expect((q.requests[1].json!.generationConfig as Record<string, unknown>).thinkingConfig).toBeUndefined()
  })

  it('reports blocked prompts and quota errors clearly', async () => {
    await expect(provider([{ status: 200, body: fx.blockedPrompt }]).p.generateJSON([{ role: 'user', content: 'x' }], { type: 'object' }, opts))
      .rejects.toMatchObject({ kind: 'bad_request', message: expect.stringMatching(/blocked this request \(SAFETY\)/) })
    await expect(drain(provider([{ status: 429, body: fx.quotaExceeded }]).p.generate([{ role: 'user', content: 'x' }], opts)))
      .rejects.toMatchObject({ kind: 'rate_limit' })
  })

  it('lists chat models and embedding models separately', async () => {
    const { p } = provider([{ status: 200, body: fx.models }, { status: 200, body: fx.models }])
    expect(await p.listModels()).toEqual(['gemini-2.5-flash'])
    expect(await p.listEmbeddingModels()).toEqual(['gemini-embedding-001'])
  })

  it('embeds in batches of 100 with retrieval task types', async () => {
    const { p, requests } = provider([{ status: 200, body: fx.embeddings(100) }, { status: 200, body: fx.embeddings(20) }, { status: 200, body: fx.embeddings(1) }])
    const texts = Array.from({ length: 120 }, (_, i) => `chunk ${i}`)
    const vs = await p.embed(texts, 'gemini-embedding-001')
    expect(vs).toHaveLength(120)
    expect(requests[0].url).toMatch(/models\/gemini-embedding-001:batchEmbedContents$/)
    expect((requests[0].json!.requests as unknown[]).length).toBe(100)
    expect((requests[0].json!.requests as Array<Record<string, unknown>>)[0]).toEqual({ model: 'models/gemini-embedding-001', content: { parts: [{ text: 'chunk 0' }] }, taskType: 'RETRIEVAL_DOCUMENT' })
    await p.embed(['what database?'], 'gemini-embedding-001', 'query')
    expect((requests[2].json!.requests as Array<Record<string, unknown>>)[0].taskType).toBe('RETRIEVAL_QUERY')
  })

  it('maps roles to user/model and merges same-role turns', () => {
    expect(toGeminiContents([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'assistant', content: 'c' }]).contents)
      .toEqual([{ role: 'user', parts: [{ text: 'a' }] }, { role: 'model', parts: [{ text: 'b\n\nc' }] }])
  })
})

describe('OpenAI-compatible embeddings', () => {
  it('POSTs /embeddings and returns vectors in input order', async () => {
    const t = fakeTransport([{ status: 200, body: JSON.stringify({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }], model: 'nomic-embed-text' }) }])
    const p = new OpenAICompatProvider({ ...config, type: 'openai-compat', baseUrl: 'http://localhost:11434/v1' }, null, t.transport)
    expect(await p.embed(['a', 'b'], 'nomic-embed-text')).toEqual([[1, 0], [0, 1]])
    expect(t.requests[0]).toMatchObject({ url: 'http://localhost:11434/v1/embeddings', json: { model: 'nomic-embed-text', input: ['a', 'b'] } })
  })
})
