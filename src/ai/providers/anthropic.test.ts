import { describe, expect, it } from 'vitest'
import { AnthropicProvider } from './anthropic'
import { strictSchema, toAnthropicMessages } from './anthropicWire'
import { THINKING_HEADROOM } from './toolCalls'
import { drain, fakeTransport } from './__fixtures__/transport'
import * as fx from './__fixtures__/anthropic.fixtures'
import type { AiProviderConfig, GenOpts, JSONSchema, TokenUsage, ToolDef } from '../../types'

const config: AiProviderConfig = {
  id: 'c1', type: 'anthropic', name: 'Claude', baseUrl: 'https://api.anthropic.com/v1',
  model: 'claude-sonnet-5-5', verified: true, contextTokens: 32000, createdAt: '2026-10-08T00:00:00Z',
}
const opts: GenOpts = { maxTokens: 256, temperature: 0.2, thinking: false }
const moveCard: ToolDef = {
  name: 'move_card', description: 'Move a card',
  parameters: { type: 'object', properties: { cardId: { type: 'string', minLength: 1 }, toColumn: { type: 'string' } }, required: ['cardId', 'toColumn'] },
}

function provider(replies: Parameters<typeof fakeTransport>[0]) {
  const t = fakeTransport(replies)
  const p = new AnthropicProvider(config, 'sk-ant-test', t.transport)
  const usages: TokenUsage[] = []
  p.onUsage = (u) => usages.push(u)
  return { p, requests: t.requests, usages }
}

describe('AnthropicProvider', () => {
  it('streams text deltas only (thinking skipped) and reports usage once', async () => {
    const { p, requests, usages } = provider([{ status: 200, body: fx.textStream }])
    const text = await drain(p.generate([{ role: 'system', content: 'Be brief.' }, { role: 'user', content: 'Hi' }], opts))
    expect(text).toBe('Hello!')
    expect(p.lastUsage()).toEqual({ promptTokens: 25, completionTokens: 15 })
    expect(usages).toEqual([{ promptTokens: 25, completionTokens: 15 }])
    const r = requests[0]
    expect(r.url).toBe('https://api.anthropic.com/v1/messages')
    expect(r.headers).toMatchObject({ 'x-api-key': 'sk-ant-test', 'anthropic-version': '2023-06-01' })
    expect(r.json).toMatchObject({ model: 'claude-sonnet-5-5', max_tokens: 256, system: 'Be brief.', stream: true, temperature: 0.2, messages: [{ role: 'user', content: 'Hi' }] })
  })

  it('turns thinking on as adaptive, with headroom and no temperature', async () => {
    const { p, requests } = provider([{ status: 200, body: fx.okMessage }])
    await p.callTools([{ role: 'user', content: 'Move KAI-4' }], [moveCard], { ...opts, thinking: true }).catch(() => {})
    expect(requests[0].json).toMatchObject({ thinking: { type: 'adaptive' }, max_tokens: 256 + THINKING_HEADROOM })
    expect(requests[0].json).not.toHaveProperty('temperature')
  })

  it('drops temperature when the model rejects it, and remembers that', async () => {
    const { p, requests } = provider([
      { status: 400, body: fx.temperatureRejected }, { status: 200, body: fx.textStream }, { status: 200, body: fx.textStream },
    ])
    expect(await drain(p.generate([{ role: 'user', content: 'Hi' }], opts))).toBe('Hello!')
    await drain(p.generate([{ role: 'user', content: 'Again' }], opts))
    expect(requests.map((r) => 'temperature' in r.json!)).toEqual([true, false, false])
  })

  it('maps tools to input_schema and tool_use blocks to validated calls', async () => {
    const { p, requests } = provider([{ status: 200, body: fx.toolUseMessage }])
    const calls = await p.callTools([{ role: 'user', content: 'Move KAI-4 to Done' }], [moveCard], opts)
    expect(calls).toEqual([{ id: 'toolu_01', name: 'move_card', args: { cardId: 'KAI-4', toColumn: 'Done' } }])
    expect(requests[0].json!.tools).toEqual([{ name: 'move_card', description: 'Move a card', input_schema: moveCard.parameters }])
    expect(p.lastUsage()).toEqual({ promptTokens: 900, completionTokens: 60 })
  })

  it('falls back to validated JSON when the model rejects tools', async () => {
    const rejected = JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'tools are not supported by this model' } })
    const fallback = JSON.stringify({ content: [{ type: 'text', text: '{"tool_calls":[{"name":"move_card","arguments":{"cardId":"KAI-4","toColumn":"Done"}}]}' }], usage: { input_tokens: 1, output_tokens: 1 } })
    const { p, requests } = provider([{ status: 400, body: rejected }, { status: 200, body: fallback }])
    const calls = await p.callTools([{ role: 'user', content: 'Move KAI-4' }], [moveCard], opts)
    expect(calls.map((c) => c.args)).toEqual([{ cardId: 'KAI-4', toColumn: 'Done' }])
    expect(requests[1].json).not.toHaveProperty('tools')
    expect(requests[1].json!.output_config).toBeDefined()
  })

  it('asks for JSON with a structured-outputs schema it accepts, and validates against the full one', async () => {
    const schema: JSONSchema = { type: 'object', properties: { intent: { type: 'string', enum: ['summarize', 'question'], minLength: 1 } }, required: ['intent'] }
    const { p, requests } = provider([{ status: 200, body: fx.jsonMessage }])
    expect(await p.generateJSON([{ role: 'user', content: 'Summarize' }], schema, opts)).toEqual({ intent: 'summarize' })
    expect(requests[0].json!.output_config).toEqual({ format: { type: 'json_schema', schema: { type: 'object', properties: { intent: { type: 'string', enum: ['summarize', 'question'] } }, required: ['intent'], additionalProperties: false } } })
  })

  it('surfaces errors with their kind: auth, overloaded, error events mid-stream', async () => {
    await expect(provider([{ status: 401, body: fx.authError }]).p.listModels()).rejects.toMatchObject({ kind: 'auth' })
    await expect(drain(provider([{ status: 529, body: fx.overloaded }]).p.generate([{ role: 'user', content: 'x' }], opts))).rejects.toMatchObject({ kind: 'server' })
    await expect(drain(provider([{ status: 200, body: fx.errorStream }]).p.generate([{ role: 'user', content: 'x' }], opts))).rejects.toMatchObject({ kind: 'network', message: expect.stringMatching(/Overloaded/) })
  })

  it('lists models and passes Test connection', async () => {
    const { p, requests } = provider([{ status: 200, body: fx.models }, { status: 200, body: fx.okMessage }])
    expect(await p.testConnection()).toEqual({ models: ['claude-opus-5-5', 'claude-sonnet-5-5'] })
    expect(requests[0].url).toBe('https://api.anthropic.com/v1/models?limit=100')
  })
})

describe('anthropic wire helpers', () => {
  it('merges same-role turns and starts with the user', () => {
    expect(toAnthropicMessages([
      { role: 'assistant', content: 'Earlier' }, { role: 'user', content: 'a' }, { role: 'user', content: 'b' },
    ]).messages).toEqual([{ role: 'user', content: '(continue)' }, { role: 'assistant', content: 'Earlier' }, { role: 'user', content: 'a\n\nb' }])
  })

  it('strips keywords structured outputs reject', () => {
    expect(strictSchema({ type: 'array', maxItems: 20, minItems: 0, items: { type: 'object', properties: { n: { type: 'integer', minimum: 1, maximum: 8 } } } }))
      .toEqual({ type: 'array', minItems: 0, items: { type: 'object', properties: { n: { type: 'integer' } }, additionalProperties: false } })
  })
})
