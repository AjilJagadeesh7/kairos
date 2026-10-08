import { describe, expect, it } from 'vitest'
import { runBoardMessage, runBoardPlan, runBoardSummary } from './boardActions'
import { annotateRelativeDates } from '../text/relativeDates'
import { fakeProvider } from './__fixtures__/fakes'
import { NOW, fakeBoardEnv, sprintBoard } from './__fixtures__/board'
import { bubbleChatRecord } from '../history/chatHistory'

describe('annotateRelativeDates (Thu 2026-10-08)', () => {
  it.each([
    ['due tomorrow', 'due tomorrow (2026-10-09)'],
    ['by friday', 'by friday (2026-10-09)'],
    ['next Thursday', 'next Thursday (2026-10-15)'],
    ['in 3 days', 'in 3 days (2026-10-11)'],
    ['next week', 'next week (2026-10-12)'],
    ['the day after tomorrow', 'the day after tomorrow (2026-10-10)'],
    ['on Oct 20', 'on Oct 20 (2026-10-20)'],
    ['by 5 January', 'by 5 January (2027-01-05)'],
    ['on 2026-11-02', 'on 2026-11-02'],
  ])('%s', (input, expected) => {
    expect(annotateRelativeDates(input, NOW)).toBe(expected)
  })
  it('is idempotent', () => {
    const once = annotateRelativeDates('move it to tomorrow and friday', NOW)
    expect(annotateRelativeDates(once, NOW)).toBe(once)
  })
})

describe('runBoardSummary', () => {
  it('attaches code-computed facts and sends them as the only numbers', async () => {
    const { provider, calls } = fakeProvider({ generate: () => '- Login bug is overdue' })
    const { env, messages } = fakeBoardEnv(provider, sprintBoard())
    await runBoardSummary(env)
    const msg = messages[0]
    expect(msg.boardFacts?.overdue.count).toBe(2)
    expect(msg.meta).toBe('9 issues · 1 done · 2 overdue · 2 blocked')
    expect(msg.content).toBe('- Login bug is overdue')
    const prompt = calls[0].messages.map((m) => m.content).join('\n')
    expect(prompt).toContain('"totalIssues":9')
    expect(prompt).toContain('<board>')
    expect(calls[0].opts.thinking).toBe(false)
  })
})

describe('runBoardPlan', () => {
  it('turns tool calls into a pending plan with valid actions preselected', async () => {
    const { provider, calls } = fakeProvider({
      tools: () => [
        { name: 'move_card', args: { cardId: 'KAI-2', toColumn: 'Done' } },
        { name: 'move_card', args: { cardId: 'KAI-3', toColumn: 'Done' } },
        { name: 'move_card', args: { cardId: 'KAI-77', toColumn: 'Done' } },
      ],
    })
    const { env, messages } = fakeBoardEnv(provider, sprintBoard())
    await runBoardPlan(env, 'Move the API cards to Done by tomorrow')
    const plan = messages[0].plan!
    expect(plan.state).toBe('pending')
    expect(plan.actions).toHaveLength(3)
    expect(plan.selected).toEqual([plan.actions[0].id, plan.actions[1].id])
    expect(messages[0].content).toBe("2 changes to review — nothing changes until you apply. 1 couldn't be matched to this board.")
    // Relative dates reach the model already resolved; tools are the board's three write tools.
    const user = calls[0].messages.at(-1)!.content
    expect(user).toContain('Request: Move the API cards to Done by tomorrow (2026-10-09)')
    expect(user).toContain('Today is 2026-10-08.')
    expect(calls[0].tools?.map((t) => t.name)).toEqual(['create_card', 'update_card', 'move_card'])
    expect(calls[0].opts.thinking).toBe(true)
  })

  it('refuses a plan with more than 20 actions', async () => {
    const { provider } = fakeProvider({
      tools: () => Array.from({ length: 21 }, (_, i) => ({ name: 'create_card', args: { column: 'To Do', title: `C${i}` } })),
    })
    const { env, messages } = fakeBoardEnv(provider, sprintBoard())
    await runBoardPlan(env, 'add lots of cards')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ role: 'notice' })
    expect(messages[0].content).toMatch(/21 changes — more than 20/)
  })

  it('says so when no change was proposed', async () => {
    const { provider } = fakeProvider({ tools: () => [] })
    const { env, messages } = fakeBoardEnv(provider, sprintBoard())
    await runBoardPlan(env, 'do the thing')
    expect(messages[0]).toMatchObject({ role: 'notice' })
  })
})

describe('runBoardMessage', () => {
  it('routes from the user message alone; card text is only data', async () => {
    const { provider, calls } = fakeProvider({ json: () => ({ intent: 'question' }), generate: () => 'Two cards are overdue.' })
    const { env, messages } = fakeBoardEnv(provider, sprintBoard())
    await runBoardMessage(env, "what's late?")
    const router = calls[0]
    expect(router.kind).toBe('json')
    expect(JSON.stringify(router.messages)).not.toContain('Ignore previous instructions')
    // The injected card is inside the <board> data block of the answer prompt, and no tools were offered.
    const answer = calls[1].messages.map((m) => m.content).join('\n')
    expect(answer).toMatch(/<board>[\s\S]*Ignore previous instructions[\s\S]*<\/board>/)
    expect(calls.some((c) => c.kind === 'tools')).toBe(false)
    expect(messages.at(-1)?.content).toBe('Two cards are overdue.')
  })

  it('sends change requests to the planner', async () => {
    const { provider, calls } = fakeProvider({
      json: () => ({ intent: 'change' }),
      tools: () => [{ name: 'create_card', args: { column: 'To Do', title: 'Fix login bug on Safari' } }],
    })
    const { env, messages } = fakeBoardEnv(provider, sprintBoard())
    await runBoardMessage(env, 'Add a card to fix login bug on Safari in To Do')
    expect(calls.map((c) => c.kind)).toEqual(['json', 'tools'])
    expect(messages[0].plan?.actions[0].summary).toBe('Add "Fix login bug on Safari" to To Do')
  })
})

describe('chat history for board sessions', () => {
  it('records the plan lines and what happened to it', async () => {
    const { provider } = fakeProvider({ tools: () => [{ name: 'move_card', args: { cardId: 'KAI-2', toColumn: 'Done' } }] })
    const { env, messages } = fakeBoardEnv(provider, sprintBoard())
    await runBoardPlan(env, 'ship KAI-2')
    const planMsg = { ...messages[0], plan: { ...messages[0].plan!, state: 'applied' as const, appliedCount: 1 } }
    const record = bubbleChatRecord({
      id: 'x', source: { kind: 'board', id: 'b1', title: 'Sprint board' }, provider: null, createdAt: '',
      messages: [{ id: 'u', role: 'user', content: 'ship KAI-2', createdAt: '' }, planMsg],
    })!
    expect(record.title).toBe('Bubble · Sprint board')
    expect(record.messages[1]).toMatchObject({
      action: 'board_plan', outcome: 'applied 1 of 1',
      content: expect.stringContaining('- Move KAI-2 "API rate limiting" → Done'),
    })
  })
})
