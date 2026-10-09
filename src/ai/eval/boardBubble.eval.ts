/**
 * Board-bubble eval against a real provider. Not part of `npm test`.
 *
 *   AI_EVAL_BASE_URL=http://localhost:11434/v1 AI_EVAL_MODEL=qwen3:4b npm run ai:eval
 *   (AI_EVAL_TYPE=anthropic|gemini with AI_EVAL_API_KEY for the native adapters)
 *
 * Optional: AI_EVAL_API_KEY, AI_EVAL_CONTEXT (prompt-token budget, default 8000).
 * Plans fail on a missing expected action or any extra action that would be
 * applied; summaries fail on numbers that aren't in the computed facts.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { evalAdapter, evalType } from './evalAdapter'
import { checkProviderUrl } from '../net/urlPolicy'
import { runBoardPlan, runBoardSummary } from '../agent/boardActions'
import { routeBoardIntent } from '../agent/boardIntent'
import { fakeBoardEnv, sprintBoard } from '../agent/__fixtures__/board'
import { BOARD_BUBBLE_PROMPT_VERSION } from '../prompts/boardBubble.v1'
import { BOARD_INTENT_CASES, PATCH_CHECKS, PLAN_CASES, type PlanCase } from './fixtures/boardBubble.fixtures'
import type { AiProviderConfig, ResolvedAction } from '../../types'

// src/ is typed for the browser; the eval runs in Node.
declare const process: { env: Record<string, string | undefined> }

const baseUrl = process.env.AI_EVAL_BASE_URL ?? ''
const model = process.env.AI_EVAL_MODEL ?? ''
const budget = Number(process.env.AI_EVAL_CONTEXT ?? 8000)

const config: AiProviderConfig = {
  id: 'eval', type: evalType, name: 'eval', baseUrl, model,
  verified: true, contextTokens: budget, createdAt: new Date().toISOString(),
}

function provider() {
  const url = checkProviderUrl(baseUrl)
  if (!url.ok) throw new Error(url.reason)
  return evalAdapter(config, process.env.AI_EVAL_API_KEY ?? null)
}

const report: Array<{ case: string; pass: boolean; ms: number; note: string }> = []

async function evalCase(name: string, run: () => Promise<string[]>) {
  const t0 = Date.now()
  let failures: string[]
  try { failures = await run() } catch (err) { failures = [`threw: ${(err as Error).message}`] }
  report.push({ case: name, pass: failures.length === 0, ms: Date.now() - t0, note: failures.join('; ').slice(0, 140) })
  expect(failures).toEqual([])
}

function matches(r: ResolvedAction, e: PlanCase['expect'][number]): boolean {
  const { titleIncludes, ...fields } = e
  if (titleIncludes && !(r.tool === 'create_card' && r.title.toLowerCase().includes(titleIncludes))) return false
  return Object.entries(fields).every(([k, v]) => (r as Record<string, unknown>)[k] === v)
}

describe.skipIf(!baseUrl || !model)(`board bubble eval (${BOARD_BUBBLE_PROMPT_VERSION}, ${model}, budget ${budget})`, () => {
  for (const c of PLAN_CASES) {
    it(`plan: ${c.name}`, () => evalCase(`plan: ${c.name}`, async () => {
      const { env, messages } = fakeBoardEnv(provider(), sprintBoard(), { budget })
      await runBoardPlan(env, c.request)
      const plan = messages.find((m) => m.plan)?.plan
      if (!plan) return [`no plan (${messages.map((m) => m.content).join(' / ').slice(0, 80)})`]
      const resolved = plan.actions.flatMap((a) => (a.resolved ? [a.resolved] : []))
      const fails: string[] = []
      for (const e of c.expect) {
        const hit = resolved.find((r) => matches(r, e))
        if (!hit) fails.push(`missing ${JSON.stringify(e)}`)
        else if (hit.tool === 'update_card' && PATCH_CHECKS[c.name] && !PATCH_CHECKS[c.name](hit.patch)) {
          fails.push(`wrong patch ${JSON.stringify(hit.patch)}`)
        }
      }
      const extra = resolved.filter((r) => !c.expect.some((e) => matches(r, e)))
      if (extra.length) fails.push(`extra: ${plan.actions.filter((a) => a.resolved && extra.includes(a.resolved)).map((a) => a.summary).join(' | ')}`)
      return fails
    }))
  }

  it('summary uses only numbers from the facts', () => evalCase('board summary', async () => {
    const board = sprintBoard()
    const { env, messages } = fakeBoardEnv(provider(), board, { budget })
    await runBoardSummary(env)
    const m = messages.find((x) => x.boardFacts)
    const text = m?.content ?? ''
    const known = `${JSON.stringify(m?.boardFacts)} ${board.tasks.map((t) => `${t.key} ${t.title} ${t.due ?? ''}`).join(' ')}`
    const invented = (text.match(/\d+/g) ?? []).filter((n) => !known.includes(n))
    const fails: string[] = []
    if (!text.trim()) fails.push('empty summary')
    if (invented.length) fails.push(`invented numbers ${invented.join(',')}`)
    if (!/KAI-1|KAI-5|login|payment/i.test(text)) fails.push('does not mention an overdue card')
    return fails
  }))

  it('routes free-text messages to the right intent', () => evalCase(`intent routing ×${BOARD_INTENT_CASES.length}`, async () => {
    const p = provider()
    const wrong: string[] = []
    for (const c of BOARD_INTENT_CASES) {
      const got = await routeBoardIntent(p, c.message)
      if (got.kind !== c.expected) wrong.push(`"${c.message}" → ${got.kind}`)
    }
    // ≥ 80% correct passes; the misses are still listed.
    return wrong.length > BOARD_INTENT_CASES.length * 0.2 ? wrong : []
  }))

  afterAll(() => {
    console.log(`\nBoard bubble eval — ${model} @ ${baseUrl} — prompts ${BOARD_BUBBLE_PROMPT_VERSION}`)
    console.table(report)
    console.log(`${report.filter((r) => r.pass).length}/${report.length} passed`)
  })
})
