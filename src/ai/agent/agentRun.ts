/**
 * The global chat agent. The model sees the user's message, a small overview
 * of the vault and a toolbox, and decides what to do: answer directly, look
 * things up (notes, cards, exact facts, the web with approval) over several
 * steps, and/or propose changes (a plan card the user applies). The final
 * answer streams, cites what was read, and shows the facts card when exact
 * counts were used. Feature code, not provider code: works with any provider.
 */
import { estimateTokens } from '../text/tokens'
import { annotateRelativeDates, isoDate } from '../text/relativeDates'
import { fitTurns, messagesTokens, usableBudget } from './budget'
import { newMessage, notice, streamInto } from './bubbleEnv'
import { agentContext } from './agentContext'
import { newAgentState, runAgentTool, type AgentState } from './agentTools'
import { planMessage } from './agentPlan'
import { vaultFactsHeader } from './vaultFacts'
import {
  AGENT_READ_TOOLS, AGENT_WEB_TOOLS, ANSWER_INSTRUCTION, PROPOSE_CHANGES_TOOL, agentMessages, agentSystem, toolResultMessages,
} from '../prompts/agent.v1'
import type { ChatSourceRef, GenOpts, GlobalEnv, Msg, ToolCall, ToolDef } from '../../types'

/** Tool rounds before the model must answer. */
export const MAX_AGENT_STEPS = 6
/** Tool calls run per round; extra ones are ignored. */
const MAX_CALLS_PER_STEP = 4
/** Share of the budget for the cards in the opening overview. */
const OVERVIEW_CARD_SHARE = 0.2

// Deciding what to do is multi-step planning: thinking on (PRD); the answer itself streams without it.
const DECIDE: GenOpts = { maxTokens: 1500, temperature: 0.2, thinking: true }
const ANSWER: GenOpts = { maxTokens: 1500, temperature: 0.4, thinking: false }

export function agentTools(env: GlobalEnv): ToolDef[] {
  return [...AGENT_READ_TOOLS, ...(env.web ? AGENT_WEB_TOOLS : []), PROPOSE_CHANGES_TOOL]
}

const describe = (c: ToolCall) => {
  const a = c.args
  const s = (v: unknown) => (typeof v === 'string' ? v : '')
  switch (c.name) {
    case 'search_notes': return `Searching your notes for “${s(a.query)}”…`
    case 'read_note': return `Reading ${s(a.note)}…`
    case 'list_cards': return `Looking at ${s(a.board) || 'your boards'}…`
    case 'vault_facts': return 'Checking the numbers…'
    case 'web_search': return `Searching the web for “${s(a.query)}”…`
    case 'fetch_url': return `Reading ${s(a.url)}…`
    default: return 'Working…'
  }
}

/** Sources for the answer's chips: the cited ones first, then the rest that were read (capped). */
function answerSources(text: string, s: AgentState): ChatSourceRef[] {
  const cited = new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))
  const all = s.sources.all()
  const shown = cited.size ? all.filter((x) => cited.has(x.n!)) : all
  return shown.slice(0, 12)
}

export async function runAgent(env: GlobalEnv, text: string): Promise<void> {
  const now = env.now()
  const s = newAgentState()
  const vault = env.vault()
  const tools = agentTools(env)
  const toolTokens = estimateTokens(JSON.stringify(tools))
  const attached = await env.attachedContext()
  // Relative dates are resolved in code (PRD): "tomorrow" → "tomorrow (2026-10-10)".
  const message = annotateRelativeDates(text, now)
  const overview = agentContext(vault, text, Math.floor(env.budget * OVERVIEW_CARD_SHARE), s)
  const system = agentSystem(overview, isoDate(now), !!env.web)
  const base = agentMessages(system, [], attached, message)
  const history = fitTurns(env.history(), usableBudget(env.budget) - messagesTokens(base) - toolTokens)
  let messages: Msg[] = agentMessages(system, history, attached, message)

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const room = usableBudget(env.budget) - messagesTokens(messages) - toolTokens - ANSWER.maxTokens
    if (room < 300) break // no room to read more: answer with what we have
    env.sink.progress(step ? 'Thinking it through…' : 'Thinking…')
    const calls = await env.provider.callTools(messages, tools, DECIDE)
    env.sink.progress(null)
    if (env.isStopped()) return
    if (!calls.length) break

    const proposal = calls.find((c) => c.name === 'propose_changes')
    if (proposal) {
      const out = planMessage(proposal, env, s, env.provider.lastUsage())
      if (typeof out === 'string') notice(env, out)
      else env.sink.add(out)
      return
    }

    const reads = calls.slice(0, MAX_CALLS_PER_STEP)
    const share = Math.floor(room / reads.length)
    const results: string[] = []
    for (const c of reads) {
      env.sink.progress(describe(c))
      results.push(`## ${c.name} ${JSON.stringify(c.args)}\n${await runAgentTool(c, env, s, share)}`)
      env.sink.progress(null)
      if (env.isStopped()) return
    }
    messages = [...messages, ...toolResultMessages(reads.map((c) => c.name).join(', '), results.join('\n\n'))]
  }

  const msg = newMessage({
    role: 'assistant', content: '', action: 'agent', streaming: true,
    meta: [s.facts ? vaultFactsHeader(s.facts) : '', ...s.steps].filter(Boolean).join(' · ') || undefined,
    vaultFacts: s.facts ?? undefined,
  })
  env.sink.add(msg)
  // After lookups, ask for the answer explicitly; with none, the conversation already ends on the user's message.
  const final: Msg[] = s.steps.length ? [...messages, { role: 'user', content: ANSWER_INSTRUCTION }] : messages
  const { text: answer, stopped } = await streamInto(env, msg.id, final, ANSWER)
  env.sink.patch(msg.id, (m) => ({
    ...m,
    meta: stopped ? [m.meta, 'Stopped'].filter(Boolean).join(' · ') : m.meta,
    sources: answerSources(answer, s),
  }))
}
