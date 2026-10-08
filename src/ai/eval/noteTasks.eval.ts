/**
 * "Turn this into tasks" eval against a real provider. Not part of `npm test`.
 *
 *   AI_EVAL_BASE_URL=http://localhost:11434/v1 AI_EVAL_MODEL=qwen3:4b npm run ai:eval
 *
 * PRD Phase 3: on 10 meeting notes, ≥ 80% of action items are extracted and
 * no item is invented. "Invented" = an item that would be created (passed the
 * code's grounding check) but matches no expected action item.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { OpenAICompatProvider } from '../providers/openaiCompat'
import { fetchStream } from '../transport/httpStream'
import { checkProviderUrl } from '../net/urlPolicy'
import { runExtractTasks } from '../agent/noteTasks'
import { fakeEnv } from '../agent/__fixtures__/fakes'
import { NOTE_TASKS_PROMPT_VERSION } from '../prompts/noteTasks.v1'
import { TASK_NOTES } from './fixtures/noteTasks.fixtures'
import type { AiProviderConfig, ExtractedTask } from '../../types'

declare const process: { env: Record<string, string | undefined> }

const baseUrl = process.env.AI_EVAL_BASE_URL ?? ''
const model = process.env.AI_EVAL_MODEL ?? ''
const budget = Number(process.env.AI_EVAL_CONTEXT ?? 8000)

const config: AiProviderConfig = {
  id: 'eval', type: 'openai-compat', name: 'eval', baseUrl, model,
  verified: true, contextTokens: budget, createdAt: new Date().toISOString(),
}

function provider() {
  const url = checkProviderUrl(baseUrl)
  if (!url.ok) throw new Error(url.reason)
  return new OpenAICompatProvider(config, process.env.AI_EVAL_API_KEY ?? null, fetchStream)
}

const matches = (t: ExtractedTask, groups: string[][]) => {
  const hay = `${t.title} ${t.quote}`.toLowerCase()
  return groups.every((alts) => alts.some((w) => hay.includes(w)))
}

const rows: Array<{ note: string; expected: number; found: number; invented: string; rejected: number }> = []

describe.skipIf(!baseUrl || !model)(`note → tasks eval (${NOTE_TASKS_PROMPT_VERSION}, ${model})`, () => {
  it('extracts ≥ 80% of action items across 10 notes, inventing none', async () => {
    let expectedTotal = 0
    let foundTotal = 0
    const invented: string[] = []
    for (const c of TASK_NOTES) {
      const { env, messages } = fakeEnv(provider(), { title: c.name, content: c.note }, { budget })
      await runExtractTasks(env)
      const tasks = messages.find((m) => m.taskPlan)?.taskPlan?.tasks ?? []
      const usable = tasks.filter((t) => !t.unresolved)
      const found = c.expected.filter((e) => usable.some((t) => matches(t, e))).length
      const extra = usable.filter((t) => !c.expected.some((e) => matches(t, e))).map((t) => t.title)
      expectedTotal += c.expected.length
      foundTotal += found
      invented.push(...extra.map((x) => `${c.name}: ${x}`))
      rows.push({ note: c.name, expected: c.expected.length, found, invented: extra.join(' | ').slice(0, 80), rejected: tasks.length - usable.length })
    }
    const recall = expectedTotal ? foundTotal / expectedTotal : 1
    console.log(`recall ${(recall * 100).toFixed(0)}% (${foundTotal}/${expectedTotal}), invented ${invented.length}`)
    expect(recall).toBeGreaterThanOrEqual(0.8)
    expect(invented).toEqual([])
  })

  afterAll(() => {
    console.log(`\nNote → tasks eval — ${model} @ ${baseUrl} — prompts ${NOTE_TASKS_PROMPT_VERSION}`)
    console.table(rows)
  })
})
