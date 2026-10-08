import { describe, expect, it } from 'vitest'
import { numberSources, runGlobalMessage, runPending, runQuery, runReview } from './globalActions'
import { attachedContextBlock, transcript, trimToLatest } from '../history/attachContext'
import { chatRecord, fromChatMessage, globalChatTitle, toChatMessages } from '../history/chatHistory'
import { retrieve } from '../index/retrieve'
import { fakeProvider } from './__fixtures__/fakes'
import { NOW } from './__fixtures__/board'
import { testVault } from './__fixtures__/vault'
import type { AiChatRecord, BubbleMessage, Condensed, GlobalEnv, LLMProvider, Msg } from '../../types'

function globalEnv(provider: LLMProvider, opts: { history?: Msg[]; attached?: string; budget?: number } = {}) {
  const messages: BubbleMessage[] = []
  const vault = testVault()
  const env: GlobalEnv = {
    provider,
    budget: opts.budget ?? 8000,
    sink: {
      add: (m) => { messages.push(m) },
      patch: (id, update) => { const i = messages.findIndex((m) => m.id === id); if (i !== -1) messages[i] = update(messages[i]) },
      progress: () => {},
    },
    isStopped: () => false,
    history: () => opts.history ?? [],
    cache: new Map<string, Condensed>(),
    attachedContext: async () => opts.attached ?? null,
    vault: () => vault,
    now: () => NOW,
    retrieve: (q, f) => retrieve(q, f, { vault, indexed: null, embedQuery: null, modelId: null }),
  }
  return { env, messages }
}

describe('runPending / runReview', () => {
  it('attach code-computed facts and source chips; the facts are the only numbers sent', async () => {
    const { provider, calls } = fakeProvider({ generate: () => '- Start with KAI-1' })
    const { env, messages } = globalEnv(provider)
    await runPending(env)
    const m = messages[0]
    expect(m.vaultFacts?.kind).toBe('pending')
    expect(m.meta).toBe('2 overdue · 3 due this week · 4 open checklist items')
    expect(m.sources?.map((s) => s.title)).toEqual(expect.arrayContaining(['KAI-5 Payment provider contract', 'HOME-1 Renew car insurance', 'Standup notes']))
    expect(m.sources?.find((s) => s.kind === 'card')).toMatchObject({ boardId: 'b1' })
    expect(calls[0].messages[1].content).toMatch(/<facts_data>[\s\S]*"openCards":10/)
  })

  it('reviews turn thinking on (PRD) and carry the review facts', async () => {
    const { provider, calls } = fakeProvider({ generate: () => 'Good week.' })
    const { env, messages } = globalEnv(provider)
    await runReview(env, 'week')
    expect(messages[0].vaultFacts).toMatchObject({ kind: 'review', period: 'week', cardsCompleted: { count: 1 } })
    expect(calls[0].opts.thinking).toBe(true)
  })
})

describe('runQuery', () => {
  it('retrieves passages, numbers them per note, and lists cited sources first', async () => {
    const { provider, calls } = fakeProvider({ generate: () => 'You use Postgres with pgx [1].' })
    const { env, messages } = globalEnv(provider)
    await runQuery(env, 'What did I write about the Go backend storage?', { kind: 'query', since: null, tags: [] })
    const m = messages[0]
    expect(m.sources?.[0]).toMatchObject({ kind: 'note', id: 'n-go', n: 1, title: 'Go backend design' })
    expect(m.meta).toMatch(/notes? searched · keyword search/)
    const prompt = calls[0].messages[1].content
    expect(prompt).toMatch(/<sources>\n\[1\] Go backend design/)
    expect(m.content).toBe('You use Postgres with pgx [1].')
  })

  it('says when nothing matched instead of guessing', async () => {
    const { provider, calls } = fakeProvider({ generate: () => "Your notes don't cover that." })
    const { env, messages } = globalEnv(provider)
    await runQuery(env, 'zebra migration patterns', { kind: 'query', since: null, tags: [] })
    expect(messages[0].sources).toEqual([])
    expect(calls[0].messages[1].content).toContain('No notes matched this question.')
  })

  it('numbers two passages from one note with the same number', () => {
    const base = { kind: 'note' as const, title: 'A', heading: '', text: '', tags: [], updatedAt: '', hash: '', score: 1 }
    const { numbers, sources } = numberSources([
      { ...base, id: 'note:a#0', docId: 'a' }, { ...base, id: 'note:b#0', docId: 'b', title: 'B' }, { ...base, id: 'note:a#1', docId: 'a' },
    ])
    expect(numbers).toEqual([1, 2, 1])
    expect(sources.map((s) => s.n)).toEqual([1, 2])
  })
})

describe('runGlobalMessage', () => {
  it('routes from the message only and refuses changes in P4', async () => {
    const { provider, calls } = fakeProvider({ json: () => ({ intent: 'change' }) })
    const { env, messages } = globalEnv(provider)
    await runGlobalMessage(env, 'Move everything tagged release to Done')
    expect(calls).toHaveLength(1)
    expect(JSON.stringify(calls[0].messages)).not.toContain('Postgres')
    expect(messages[0]).toMatchObject({ role: 'notice' })
    expect(messages[0].content).toMatch(/can't make changes yet/)
  })

  it('maps review periods and query filters', async () => {
    const { provider } = fakeProvider({ json: () => ({ intent: 'query', since: 'week', tags: ['#travel'] }), generate: () => 'ok' })
    const { env, messages } = globalEnv(provider)
    await runGlobalMessage(env, 'what did I note about trips this week?')
    expect(messages[0].meta).toMatch(/\(edited this week, tagged travel\)/)
  })
})

describe('attached context and saved threads', () => {
  const rec = (n: number): AiChatRecord => ({
    id: `c${n}`, surface: 'bubble', title: `Bubble · Note ${n}`, source: null, attachedChatIds: [], provider: null,
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z',
    messages: Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'assistant' as const : 'user' as const, content: `message ${i} ${'word '.repeat(20)}`, createdAt: '' })),
  })

  it('keeps short transcripts whole, trims long ones to the latest lines, summarizes when most would be lost', async () => {
    const summarize = async () => 'SUMMARY'
    const small = await attachedContextBlock([rec(2)], 400, summarize)
    expect(small).toContain('<earlier_conversations>')
    expect(small).toContain('message 0')
    expect(trimToLatest(transcript(rec(10)), 120).text).toMatch(/^\(\d+ earlier lines left out\)/)
    const huge = await attachedContextBlock([rec(60)], 300, summarize)
    expect(huge).toContain('(summary)\nSUMMARY')
  })

  it('global threads round-trip facts and sources, and are titled by their first question', () => {
    const msgs: BubbleMessage[] = [
      { id: '1', role: 'user', content: "What's pending this week?", createdAt: 'a' },
      { id: '2', role: 'assistant', content: 'Do KAI-1 first', createdAt: 'b', action: 'pending', meta: 'm', sources: [{ kind: 'card', id: 't', boardId: 'b', title: 'KAI-1' }] },
      { id: '3', role: 'notice', content: 'Stopped.', createdAt: 'c' },
    ]
    const r = chatRecord({ id: 'g', surface: 'global', source: null, provider: null, messages: msgs, attachedChatIds: ['c1'], createdAt: 'x' })!
    expect(r).toMatchObject({ title: "What's pending this week?", surface: 'global', attachedChatIds: ['c1'] })
    expect(r.messages).toHaveLength(2)
    expect(fromChatMessage(toChatMessages(msgs)[1])).toMatchObject({ role: 'assistant', meta: 'm', sources: msgs[1].sources })
    expect(globalChatTitle('x'.repeat(80))).toHaveLength(60)
  })
})
