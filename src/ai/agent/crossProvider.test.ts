/**
 * PRD P6: "All Phase 1–5 features work unchanged with each provider type."
 * The same feature runners drive each real adapter; only the wire replies
 * differ (recorded in each provider's format). Feature code never branches
 * on the provider.
 */
import { describe, expect, it } from 'vitest'
import { OpenAICompatProvider } from '../providers/openaiCompat'
import { AnthropicProvider } from '../providers/anthropic'
import { GeminiProvider } from '../providers/gemini'
import { fakeTransport, sse, type Reply } from '../providers/__fixtures__/transport'
import { runRewrite } from './noteWriting'
import { runBoardMessage } from './boardActions'
import { runGlobalMessage } from './globalActions'
import { fakeBridge, fakeEnv } from './__fixtures__/fakes'
import { fakeBoardEnv, sprintBoard } from './__fixtures__/board'
import { fakeGlobalEnv } from './__fixtures__/globalEnv'
import type { AiProviderConfig, AiProviderType, LLMProvider } from '../../types'

type HttpType = Exclude<AiProviderType, 'on-device'>
type Semantic = { json: unknown } | { tools: Array<{ name: string; args: unknown }> } | { stream: string }

/** One semantic reply in each provider's wire format. */
const WIRE: Record<HttpType, (r: Semantic) => Reply> = {
  'openai-compat': (r) => 'stream' in r
    ? { status: 200, body: sse([{ data: { choices: [{ delta: { content: r.stream } }] } }, { data: { choices: [], usage: { prompt_tokens: 9, completion_tokens: 3 } } }, { data: '[DONE]' }]) }
    : { status: 200, body: JSON.stringify({ choices: [{ message: 'json' in r
        ? { content: JSON.stringify(r.json) }
        : { content: null, tool_calls: r.tools.map((t, i) => ({ id: `c${i}`, type: 'function', function: { name: t.name, arguments: JSON.stringify(t.args) } })) } }],
      usage: { prompt_tokens: 9, completion_tokens: 3 } }) },
  anthropic: (r) => 'stream' in r
    ? { status: 200, body: sse([
        { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 9, output_tokens: 1 } } } },
        { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: r.stream } } },
        { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 3 } } },
        { event: 'message_stop', data: { type: 'message_stop' } },
      ]) }
    : { status: 200, body: JSON.stringify({ type: 'message', content: 'json' in r
        ? [{ type: 'text', text: JSON.stringify(r.json) }]
        : r.tools.map((t, i) => ({ type: 'tool_use', id: `toolu_${i}`, name: t.name, input: t.args })),
      usage: { input_tokens: 9, output_tokens: 3 } }) },
  gemini: (r) => 'stream' in r
    ? { status: 200, body: sse([{ data: { candidates: [{ content: { role: 'model', parts: [{ text: r.stream }] } }], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 3 } } }]) }
    : { status: 200, body: JSON.stringify({ candidates: [{ content: { role: 'model', parts: 'json' in r
        ? [{ text: JSON.stringify(r.json) }]
        : r.tools.map((t) => ({ functionCall: { name: t.name, args: t.args } })) } }],
      usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 3 } }) },
}

function make(type: HttpType, script: Semantic[]): LLMProvider {
  const cfg: AiProviderConfig = { id: type, type, name: type, baseUrl: 'https://example.test/v1', model: 'm', verified: true, contextTokens: 8000, createdAt: '' }
  const { transport } = fakeTransport(script.map(WIRE[type]))
  return type === 'anthropic' ? new AnthropicProvider(cfg, 'k', transport)
    : type === 'gemini' ? new GeminiProvider(cfg, 'k', transport)
    : new OpenAICompatProvider(cfg, 'k', transport)
}

const TYPES: HttpType[] = ['openai-compat', 'anthropic', 'gemini']

describe.each(TYPES)('features through the %s adapter', (type) => {
  it('P1: rewrite a selection → diff suggestion, nothing written', async () => {
    const { bridge, state } = fakeBridge({ markdown: 'this are wrong' })
    const { env, messages } = fakeEnv(make(type, [{ stream: 'This is right.' }]), { content: 'this are wrong' }, { bridge })
    await runRewrite(env, 'grammar', bridge.selection()!)
    expect(messages.at(-1)!.suggestion).toMatchObject({ kind: 'replace', proposed: 'This is right.', state: 'pending' })
    expect(state.applied).toEqual([])
  })

  it('P2: board change → intent routed, native tool calls → validated plan', async () => {
    const provider = make(type, [{ json: { intent: 'change' } }, { tools: [{ name: 'move_card', args: { cardId: 'KAI-4', toColumn: 'Done' } }] }])
    const { env, messages } = fakeBoardEnv(provider, sprintBoard())
    await runBoardMessage(env, 'Move KAI-4 to Done')
    expect(messages.at(-1)!.plan!.actions[0]).toMatchObject({ summary: 'Move KAI-4 "Write release notes" → Done', resolved: { tool: 'move_card' } })
  })

  it('P4: agent looks the notes up, then streams an answer with source chips', async () => {
    const provider = make(type, [{ tools: [{ name: 'search_notes', args: { query: 'Go backend database' } }] }, { tools: [] }, { stream: 'Postgres with pgx [1].' }])
    const { env, messages } = fakeGlobalEnv(provider)
    await runGlobalMessage(env, 'What database does the Go backend use?')
    expect(messages.at(-1)!.content).toBe('Postgres with pgx [1].')
    expect(messages.at(-1)!.sources![0]).toMatchObject({ title: 'Go backend design', n: 1 })
  })

  it('P5: agent proposes changes → plan across boards and notes', async () => {
    const provider = make(type, [
      { tools: [{ name: 'propose_changes', args: { changes: [{ action: 'move_card', cardId: 'HOME-1', toColumn: 'Done' }, { action: 'create_note', title: 'Plan', body: '- HOME-2' }] } }] },
    ])
    const { env, messages } = fakeGlobalEnv(provider)
    await runGlobalMessage(env, 'Mark the car insurance done and make a plan note')
    expect(messages.at(-1)!.globalPlan!.actions.map((a) => a.summary)).toEqual(['Move HOME-1 "Renew car insurance" → Done (Home)', 'Create note "Plan"'])
  })
})
