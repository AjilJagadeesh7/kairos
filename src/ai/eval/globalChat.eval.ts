/**
 * Global-chat eval against a real provider. Not part of `npm test`.
 *
 *   AI_EVAL_BASE_URL=http://localhost:11434/v1 AI_EVAL_MODEL=qwen3:4b npm run ai:eval
 *
 * Review/pending prose may only use numbers that are in the computed facts
 * (the facts block itself is code, so its numbers are exact by construction);
 * answers must cite the right note, and say so when the notes don't cover it.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { OpenAICompatProvider } from '../providers/openaiCompat'
import { fetchStream } from '../transport/httpStream'
import { checkProviderUrl } from '../net/urlPolicy'
import { runPending, runQuery, runReview } from '../agent/globalActions'
import { routeGlobalIntent } from '../agent/globalIntent'
import { retrieve } from '../index/retrieve'
import { NOW } from '../agent/__fixtures__/board'
import { testVault } from '../agent/__fixtures__/vault'
import { GLOBAL_CHAT_PROMPT_VERSION } from '../prompts/globalChat.v1'
import type { AiProviderConfig, BubbleMessage, Condensed, GlobalEnv, GlobalIntent } from '../../types'

declare const process: { env: Record<string, string | undefined> }

const baseUrl = process.env.AI_EVAL_BASE_URL ?? ''
const model = process.env.AI_EVAL_MODEL ?? ''
const budget = Number(process.env.AI_EVAL_CONTEXT ?? 8000)

const config: AiProviderConfig = {
  id: 'eval', type: 'openai-compat', name: 'eval', baseUrl, model,
  verified: true, contextTokens: budget, createdAt: new Date().toISOString(),
}

function env() {
  const url = checkProviderUrl(baseUrl)
  if (!url.ok) throw new Error(url.reason)
  const provider = new OpenAICompatProvider(config, process.env.AI_EVAL_API_KEY ?? null, fetchStream)
  const messages: BubbleMessage[] = []
  const vault = testVault()
  const e: GlobalEnv = {
    provider, budget,
    sink: {
      add: (m) => { messages.push(m) },
      patch: (id, u) => { const i = messages.findIndex((m) => m.id === id); if (i !== -1) messages[i] = u(messages[i]) },
      progress: () => {},
    },
    isStopped: () => false, history: () => [], cache: new Map<string, Condensed>(), attachedContext: async () => null,
    vault: () => vault, now: () => NOW,
    retrieve: (q, f) => retrieve(q, f, { vault, indexed: null, embedQuery: null, modelId: null }),
  }
  return { env: e, messages, vault }
}

const report: Array<{ case: string; pass: boolean; ms: number; note: string }> = []
async function evalCase(name: string, run: () => Promise<string[]>) {
  const t0 = Date.now()
  let failures: string[]
  try { failures = await run() } catch (err) { failures = [`threw: ${(err as Error).message}`] }
  report.push({ case: name, pass: failures.length === 0, ms: Date.now() - t0, note: failures.join('; ').slice(0, 140) })
  expect(failures).toEqual([])
}

/** Numbers in the prose that appear nowhere in the facts or the cards/notes they list. */
function invented(text: string, m: BubbleMessage | undefined, vault: ReturnType<typeof testVault>): string[] {
  const known = `${JSON.stringify(m?.vaultFacts)} ${vault.boards.flatMap((b) => b.tasks.map((t) => `${t.key} ${t.title}`)).join(' ')} ${vault.notes.map((n) => n.title).join(' ')}`
  return (text.match(/\d+/g) ?? []).filter((n) => !known.includes(n))
}

const INTENTS: Array<{ message: string; expected: GlobalIntent['kind'] }> = [
  { message: "What's pending this week?", expected: 'pending' },
  { message: 'What do I still need to do?', expected: 'pending' },
  { message: 'Give me a weekly review', expected: 'review' },
  { message: 'What did I get done today?', expected: 'review' },
  { message: 'What did I write about the Go backend?', expected: 'query' },
  { message: 'Which database do we use?', expected: 'query' },
  { message: 'Move everything tagged release to Done', expected: 'change' },
  { message: 'Create a note for tomorrow\'s planning', expected: 'change' },
  { message: 'Hi there!', expected: 'chitchat' },
  { message: 'Thanks, that helps', expected: 'chitchat' },
]

describe.skipIf(!baseUrl || !model)(`global chat eval (${GLOBAL_CHAT_PROMPT_VERSION}, ${model})`, () => {
  for (const kind of ['pending', 'week', 'day'] as const) {
    it(`${kind}: prose uses only numbers from the facts`, () => evalCase(`${kind} — no invented numbers`, async () => {
      const { env: e, messages, vault } = env()
      if (kind === 'pending') await runPending(e)
      else await runReview(e, kind)
      const m = messages.find((x) => x.vaultFacts)
      const bad = invented(m?.content ?? '', m, vault)
      return [...(!m?.content.trim() ? ['empty answer'] : []), ...(bad.length ? [`invented numbers ${bad.join(',')}`] : [])]
    }))
  }

  it('answers from the right note and cites it', () => evalCase('query — cites the Go note', async () => {
    const { env: e, messages } = env()
    await runQuery(e, 'What database does the Go backend use?', { kind: 'query', since: null, tags: [] })
    const m = messages[0]
    const goN = m.sources?.find((s) => s.id === 'n-go')?.n
    const fails: string[] = []
    if (!/postgres/i.test(m.content)) fails.push('did not say Postgres')
    if (!goN || !m.content.includes(`[${goN}]`)) fails.push(`did not cite [${goN}]`)
    return fails
  }))

  it('says when the notes do not cover a question', () => evalCase('query — admits no answer', async () => {
    const { env: e, messages } = env()
    await runQuery(e, 'What is my passport number?', { kind: 'query', since: null, tags: [] })
    return /n['’]?t cover|not (in|covered|mentioned)|no (information|mention)|don['’]?t (say|mention|contain)|couldn['’]?t find/i.test(messages[0].content)
      ? [] : [`answered anyway: ${messages[0].content.slice(0, 80)}`]
  }))

  it('routes messages to the right intent', () => evalCase(`intent routing ×${INTENTS.length}`, async () => {
    const { env: e } = env()
    const wrong: string[] = []
    for (const c of INTENTS) {
      const got = await routeGlobalIntent(e.provider, c.message)
      if (got.kind !== c.expected) wrong.push(`"${c.message}" → ${got.kind}`)
    }
    return wrong.length > INTENTS.length * 0.2 ? wrong : []
  }))

  afterAll(() => {
    console.log(`\nGlobal chat eval — ${model} @ ${baseUrl} — prompts ${GLOBAL_CHAT_PROMPT_VERSION}`)
    console.table(report)
    console.log(`${report.filter((r) => r.pass).length}/${report.length} passed`)
  })
})

