/**
 * Global-chat actions (read-only, P4): what's pending, reviews, questions
 * answered from retrieved notes, and small talk. Facts and sources come from
 * code; every answer that used vault data carries source chips.
 */
import { estimateTokens } from '../text/tokens'
import { computePendingFacts, computeReviewFacts, vaultFactsHeader, periodStart } from './vaultFacts'
import { routeGlobalIntent } from './globalIntent'
import { fitTurns, messagesTokens, pageAllowance, usableBudget } from './budget'
import { GEN, newMessage, notice, streamInto } from './bubbleEnv'
import { chitchatMessages, factsMessages, queryMessages } from '../prompts/globalChat.v1'
import type {
  ChatSourceRef, GenOpts, GlobalEnv, GlobalIntent, Msg, PendingFacts, RetrievedChunk, ReviewFacts, ReviewPeriod,
} from '../../types'

// Reviews and multi-item answers get thinking (PRD); plain questions don't.
const REVIEW_GEN: GenOpts = { maxTokens: 900, temperature: 0.3, thinking: true }

function factSources(f: PendingFacts | ReviewFacts): ChatSourceRef[] {
  const out: ChatSourceRef[] = []
  const seen = new Set<string>()
  const push = (s: ChatSourceRef) => {
    const k = `${s.kind}:${s.id}`
    if (!seen.has(k)) { seen.add(k); out.push(s) }
  }
  const cards = f.kind === 'pending'
    ? [...f.overdue.cards, ...f.dueThisWeek.cards]
    : [...f.cardsCompleted.cards, ...f.cardsMoved.cards, ...f.cardsCreated.cards]
  const notes = f.kind === 'pending'
    ? f.notesWithOpenItems.notes
    : [...f.notesCreated.notes, ...f.notesEdited.notes, ...f.journalEntries.notes]
  for (const c of cards) if (c.id) push({ kind: 'card', id: c.id, boardId: c.boardId, title: `${c.key} ${c.title}` })
  for (const n of notes) push({ kind: n.kind, id: n.id, title: n.title })
  return out
}

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

/** One number per document, in order of first appearance, so chips and citations agree. */
export function numberSources(chunks: RetrievedChunk[]): { numbers: number[]; sources: ChatSourceRef[] } {
  const byDoc = new Map<string, number>()
  const sources: ChatSourceRef[] = []
  const numbers = chunks.map((c) => {
    const key = `${c.kind}:${c.docId}`
    if (!byDoc.has(key)) {
      byDoc.set(key, byDoc.size + 1)
      sources.push({ kind: c.kind, id: c.docId, title: c.title, n: byDoc.size })
    }
    return byDoc.get(key)!
  })
  return { numbers, sources }
}

export async function runQuery(env: GlobalEnv, question: string, intent: Extract<GlobalIntent, { kind: 'query' }>): Promise<void> {
  const msg = newMessage({ role: 'assistant', content: '', action: 'query', streaming: true })
  env.sink.add(msg)
  env.sink.progress('Searching your notes…')
  const since = intent.since ? periodStart(intent.since, env.now()).toISOString() : undefined
  const found = await env.retrieve(question, { since, tags: intent.tags })
  env.sink.progress(null)
  if (env.isStopped()) return

  // Fit the best chunks into what the budget leaves after the fixed parts and recent turns.
  const attached = await env.attachedContext()
  const turns = env.history()
  const allowance = pageAllowance(env.budget, messagesTokens(queryMessages([], attached, [], question)), turns)
  const chunks: RetrievedChunk[] = []
  let used = 0
  for (const c of found.chunks) {
    const cost = estimateTokens(c.text) + 20
    if (used + cost > allowance) continue
    chunks.push(c)
    used += cost
  }
  const { numbers, sources } = numberSources(chunks)
  const numbered = chunks.map((c, i) => ({ ...c, n: numbers[i] }))
  const filters = [intent.since ? `edited this ${intent.since}` : '', intent.tags.length ? `tagged ${intent.tags.join(', ')}` : ''].filter(Boolean).join(', ')
  const meta = [
    `${sources.length} note${sources.length === 1 ? '' : 's'} searched${filters ? ` (${filters})` : ''}`,
    found.mode === 'keyword' ? 'keyword search' : 'keyword + semantic search',
  ].join(' · ')
  env.sink.patch(msg.id, (m) => ({ ...m, meta, sources }))

  const base = queryMessages(numbered, attached, [], question)
  const history = fitTurns(turns, usableBudget(env.budget) - messagesTokens(base))
  const { text, stopped } = await streamInto(env, msg.id, queryMessages(numbered, attached, history, question), GEN.question)
  // Cited sources first; the rest stay listed — the answer drew on all of them.
  const cited = new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))
  env.sink.patch(msg.id, (m) => ({
    ...m,
    meta: stopped ? `${m.meta} · Stopped` : m.meta,
    sources: [...sources].sort((a, b) => Number(cited.has(b.n!)) - Number(cited.has(a.n!)) || a.n! - b.n!),
  }))
}

export async function runChitchat(env: GlobalEnv, message: string): Promise<void> {
  const attached = await env.attachedContext()
  const msg = newMessage({ role: 'assistant', content: '', action: 'chitchat', streaming: true })
  env.sink.add(msg)
  const history = turnsFor(env, messagesTokens(chitchatMessages(attached, [], message)))
  await streamInto(env, msg.id, chitchatMessages(attached, history, message), GEN.question)
}

/** A free-text message: the model picks the intent from the message alone. */
export async function runGlobalMessage(env: GlobalEnv, text: string): Promise<void> {
  const intent = await routeGlobalIntent(env.provider, text)
  if (env.isStopped()) return
  switch (intent.kind) {
    case 'pending': return runPending(env, text)
    case 'review': return runReview(env, intent.period, text)
    case 'query': return runQuery(env, text, intent)
    case 'chitchat': return runChitchat(env, text)
    case 'change':
      notice(env, 'The global chat can\'t make changes yet — that comes in a later update. Open the note or board and use its AI bubble (the sparkles button) to change it.')
  }
}
