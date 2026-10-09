/**
 * Global-chat actions. Free-text messages go to the agent, which decides
 * what to do (agentRun.ts). The quick buttons — what's pending, daily and
 * weekly review — stay deterministic: facts computed in code, rendered as a
 * card, and the model only comments on them.
 */
import { computePendingFacts, computeReviewFacts, factSources, vaultFactsHeader } from './vaultFacts'
import { fitTurns, messagesTokens, usableBudget } from './budget'
import { GEN, newMessage, streamInto } from './bubbleEnv'
import { runAgent } from './agentRun'
import { factsMessages } from '../prompts/globalChat.v2'
import type { GenOpts, GlobalEnv, Msg, PendingFacts, ReviewFacts, ReviewPeriod } from '../../types'

// Reviews and multi-item answers get thinking (PRD); plain questions don't.
const REVIEW_GEN: GenOpts = { maxTokens: 900, temperature: 0.3, thinking: true }

/** Earlier turns that fit after the fixed parts of the prompt. */
function turnsFor(env: GlobalEnv, used: number): Msg[] {
  return fitTurns(env.history(), usableBudget(env.budget) - used)
}

async function runFacts(env: GlobalEnv, facts: PendingFacts | ReviewFacts, request: string): Promise<void> {
  const attached = await env.attachedContext()
  const factsText = JSON.stringify(facts)
  const action = facts.kind
  const msg = newMessage({
    role: 'assistant', content: '', action, streaming: true,
    meta: vaultFactsHeader(facts), vaultFacts: facts, sources: factSources(facts),
  })
  env.sink.add(msg)
  const base = factsMessages(facts.kind, factsText, attached, [], request)
  const history = turnsFor(env, messagesTokens(base))
  const { stopped } = await streamInto(env, msg.id, factsMessages(facts.kind, factsText, attached, history, request),
    facts.kind === 'review' ? REVIEW_GEN : GEN.question)
  if (stopped) env.sink.patch(msg.id, (m) => ({ ...m, meta: `${m.meta} · Stopped` }))
}

export function runPending(env: GlobalEnv, request = "What's pending this week?"): Promise<void> {
  return runFacts(env, computePendingFacts(env.vault(), env.now()), request)
}

export function runReview(env: GlobalEnv, period: ReviewPeriod, request?: string): Promise<void> {
  const label = period === 'day' ? 'Daily review' : period === 'week' ? 'Weekly review' : 'Monthly review'
  return runFacts(env, computeReviewFacts(env.vault(), period, env.now()), request ?? label)
}

/** A free-text message: the agent decides what to do with it. */
export function runGlobalMessage(env: GlobalEnv, text: string): Promise<void> {
  return runAgent(env, text)
}
