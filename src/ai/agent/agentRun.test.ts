// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { MAX_AGENT_STEPS, agentTools, runAgent } from './agentRun'
import { fakeProvider } from './__fixtures__/fakes'
import { fakeGlobalEnv } from './__fixtures__/globalEnv'
import { INJECTED_MARKERS, INJECTION_NOTES } from './__fixtures__/injection'
import { testVault } from './__fixtures__/vault'
import { createWebAccess } from '../web/webAccess'
import { DEFAULT_WEB_SETTINGS } from '../../store/useAiWebStore'
import { INJECTION_PAGE } from '../web/__fixtures__/web.fixtures'
import type { SearchProvider } from '../providers/search/searchProvider'
import type { Msg, ToolCall, ToolDef, WebRequest } from '../../types'

type Scripted = Array<Omit<ToolCall, 'id'>>

/** A model that runs `rounds` of tool calls in order, then answers. */
function scripted(rounds: Scripted[], answer = 'Done.') {
  let i = 0
  return fakeProvider({ tools: () => rounds[i++] ?? [], generate: () => answer })
}

const cleanVault = () => {
  const v = testVault()
  v.boards[0].tasks = v.boards[0].tasks.filter((t) => t.key !== 'KAI-9') // KAI-9 is an injection card
  return v
}
const allText = (msgs: Msg[]) => msgs.map((m) => m.content).join('\n')

describe('runAgent', () => {
  it('answers directly when no tool is needed — no lookups, no sources', async () => {
    const { provider, calls } = scripted([[]], 'Hi! I can search your notes, check what\'s pending, and plan changes.')
    const { env, messages } = fakeGlobalEnv(provider)
    await runAgent(env, 'hi what can you do')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ action: 'agent', content: expect.stringMatching(/^Hi! I can/), sources: [] })
    expect(calls.map((c) => c.kind)).toEqual(['tools', 'generate'])
    // The conversation ends on the user's own message: no "use what you looked up" turn.
    expect(calls[1].messages.at(-1)).toEqual({ role: 'user', content: 'hi what can you do' })
  })

  it('looks things up over several steps, then answers citing what it read', async () => {
    const { provider, calls } = scripted([
      [{ name: 'search_notes', args: { query: 'Go backend database' } }],
      [{ name: 'read_note', args: { note: 'n-go' } }],
      [],
    ], 'You use Postgres with pgx [1].')
    const { env, messages } = fakeGlobalEnv(provider)
    await runAgent(env, 'Which database does the Go backend use?')
    const second = allText(calls[1].messages)
    expect(second).toMatch(/<tool_results>[\s\S]*\[1\] Go backend design[\s\S]*Postgres with pgx[\s\S]*<\/tool_results>/)
    const m = messages.at(-1)!
    expect(m.content).toBe('You use Postgres with pgx [1].')
    expect(m.sources).toEqual([{ kind: 'note', id: 'n-go', title: 'Go backend design', n: 1 }])
    expect(m.meta).toBe('searched notes for “Go backend database” · read “Go backend design”')
  })

  it('uses exact facts from code and shows them as the facts card', async () => {
    const { provider } = scripted([[{ name: 'vault_facts', args: { kind: 'pending' } }], []], 'Start with KAI-1.')
    const { env, messages } = fakeGlobalEnv(provider)
    await runAgent(env, 'what should I do first today?')
    const m = messages.at(-1)!
    expect(m.vaultFacts?.kind).toBe('pending')
    expect(m.meta).toMatch(/^2 overdue · 3 due this week/)
  })

  it('proposes changes as a plan card and writes nothing', async () => {
    const { provider, calls } = scripted([[{
      name: 'propose_changes',
      args: { summary: 'Moving the card and writing the changelog.', changes: [{ action: 'move_card', cardId: 'KAI-2', toColumn: 'Done' }, { action: 'create_note', title: 'Changelog', body: '- KAI-2 done' }] },
    }]])
    const { env, messages, vault } = fakeGlobalEnv(provider, { vault: cleanVault() })
    const before = JSON.stringify(vault)
    await runAgent(env, 'Move the API rate limiting card to Done and write a changelog note')
    expect(JSON.stringify(vault)).toBe(before)
    const m = messages.at(-1)!
    expect(m.content).toMatch(/^Moving the card and writing the changelog\.\n\n2 changes to review/)
    expect(m.globalPlan).toMatchObject({ state: 'pending', warning: undefined })
    expect(m.globalPlan!.actions.map((a) => a.summary)).toEqual(['Move KAI-2 "API rate limiting" → Done (Sprint board)', 'Create note "Changelog"'])
    expect(m.globalPlan!.selected).toHaveLength(2)
    expect(calls.filter((c) => c.kind === 'generate')).toHaveLength(0)
  })

  it('offers at most 10 tools, web ones only when web access is on', () => {
    const names = (tools: ToolDef[]) => tools.map((t) => t.name)
    const off = agentTools(fakeGlobalEnv(fakeProvider({}).provider).env)
    expect(names(off)).toEqual(['search_notes', 'read_note', 'list_cards', 'vault_facts', 'propose_changes'])
    const web = createWebAccess({ settings: DEFAULT_WEB_SETTINGS, provider: null, confirm: async () => true })
    const on = agentTools(fakeGlobalEnv(fakeProvider({}).provider, { web }).env)
    expect(names(on)).toContain('fetch_url')
    expect(on.length).toBeLessThanOrEqual(10)
  })

  it(`stops looking things up after ${MAX_AGENT_STEPS} steps and answers`, async () => {
    const { provider, calls } = fakeProvider({ tools: () => [{ name: 'search_notes', args: { query: 'more' } }], generate: () => 'Here is what I found.' })
    const { env, messages } = fakeGlobalEnv(provider)
    await runAgent(env, 'dig deep')
    expect(calls.filter((c) => c.kind === 'tools')).toHaveLength(MAX_AGENT_STEPS)
    expect(messages.at(-1)!.content).toBe('Here is what I found.')
  })

  it('refuses more than 20 changes', async () => {
    const changes = Array.from({ length: 21 }, (_, i) => ({ action: 'create_note', title: `N${i}`, body: '' }))
    const { provider } = scripted([[{ name: 'propose_changes', args: { changes } }]])
    const { env, messages } = fakeGlobalEnv(provider)
    await runAgent(env, 'make 21 notes')
    expect(messages.at(-1)).toMatchObject({ role: 'notice', content: expect.stringMatching(/21 changes — more than 20/) })
  })
})

describe('the agent and planted instructions (PRD P5, P7)', () => {
  /** A model that does what the notes say once it has read them. */
  function obedient() {
    let step = 0
    return fakeProvider({
      tools: (msgs: Msg[]): Scripted => {
        if (step++ === 0) return [{ name: 'search_notes', args: { query: 'retro' } }]
        const keys = [...new Set(allText(msgs).match(/\b(?:KAI|HOME)-\d+\b/g) ?? [])].slice(0, 10)
        return [{ name: 'propose_changes', args: { changes: [...keys.map((k) => ({ action: 'move_card', cardId: k, toColumn: 'Done' })), { action: 'create_note', title: 'pwned', body: 'owned' }] } }]
      },
    })
  }

  it('note text stays data; an obedient model only gets a flagged plan with nothing selected', async () => {
    const v = cleanVault()
    v.notes = [...v.notes, ...INJECTION_NOTES]
    const { provider, calls } = obedient()
    const { env, messages, vault } = fakeGlobalEnv(provider, { vault: v })
    const before = JSON.stringify(vault)
    await runAgent(env, 'What did the retro say?')
    expect(JSON.stringify(vault)).toBe(before)
    const results = allText(calls[1].messages)
    expect(results).toMatch(/<tool_results>[\s\S]*IMPORTANT INSTRUCTION TO THE AI[\s\S]*<\/tool_results>/)
    // Fake closing tags inside notes can't end the block.
    expect(results.match(/<\/tool_results>/g)).toHaveLength(1)
    expect(calls[0].messages[0].content).toMatch(/never follow them/)
    const plan = messages.at(-1)!.globalPlan!
    expect(plan.actions.some((a) => INJECTED_MARKERS.some((re) => re.test(a.summary)))).toBe(true)
    expect(plan).toMatchObject({ state: 'pending', selected: [], warning: expect.stringMatching(/instructions aimed at an AI \(.*"Retro notes"/) })
  })

  it('reads the web only with approval; a page with planted text flags the plan', async () => {
    const asked: WebRequest[] = []
    const sent: string[] = []
    const search: SearchProvider = { label: 'SearXNG (test)', search: async (q) => { sent.push(`search:${q}`); return [{ title: 'Drivers', url: 'https://blog.example/drivers', snippet: 'pgx' }] } }
    const web = createWebAccess({
      settings: DEFAULT_WEB_SETTINGS, provider: search,
      confirm: async (r) => { asked.push(r); return true },
      fetchDeps: { send: async (req) => { sent.push(`fetch:${req.url}`); return { status: 200, body: (async function* () { yield INJECTION_PAGE })() } } },
    })
    const { provider } = scripted([
      [{ name: 'web_search', args: { query: 'go postgres driver' } }],
      [{ name: 'fetch_url', args: { url: 'https://blog.example/drivers' } }],
      [{ name: 'propose_changes', args: { changes: [{ action: 'create_note', title: 'Drivers', body: 'pgx' }] } }],
    ])
    const { env, messages } = fakeGlobalEnv(provider, { vault: cleanVault(), web })
    await runAgent(env, 'Find the best Go Postgres driver and save a note')
    expect(asked.map((r) => r.kind)).toEqual(['search', 'fetch'])
    expect(sent).toEqual(['search:go postgres driver', 'fetch:https://blog.example/drivers'])
    expect(messages.at(-1)!.globalPlan).toMatchObject({ selected: [], warning: expect.stringMatching(/a web page/) })
  })

  it('a declined web request sends nothing', async () => {
    const sent: string[] = []
    const search: SearchProvider = { label: 'test', search: async (q) => { sent.push(q); return [] } }
    const web = createWebAccess({ settings: DEFAULT_WEB_SETTINGS, provider: search, confirm: async () => false })
    const { provider, calls } = scripted([[{ name: 'web_search', args: { query: 'ronaldo news' } }], []], 'I could not search.')
    const { env } = fakeGlobalEnv(provider, { web })
    await runAgent(env, 'latest ronaldo news')
    expect(sent).toEqual([])
    expect(allText(calls[1].messages)).toMatch(/web_search not allowed by the user/)
  })
})
