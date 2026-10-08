/**
 * Board-bubble actions: summarize the board, answer a question about it, and
 * propose changes as a plan the user confirms — plus routing a free-text
 * message to one of them. Nothing here writes to the board.
 */
import { estimateTokens } from '../text/tokens'
import { annotateRelativeDates, isoDate } from '../text/relativeDates'
import { boardFactsHeader, computeBoardFacts } from './boardFacts'
import { boardListing, type BoardListing } from './boardContext'
import { MAX_PLAN_ACTIONS, planFromToolCalls } from './boardPlan'
import { routeBoardIntent } from './boardIntent'
import { fitTurns, messagesTokens, pageAllowance, usableBudget } from './budget'
import { GEN, newMessage, notice, streamInto } from './bubbleEnv'
import {
  BOARD_TOOLS, boardPlanMessages, boardQuestionMessages, boardSummaryMessages,
} from '../prompts/boardBubble.v1'
import type { BoardBubbleEnv, PlanAction } from '../../types'

const TOOLS_TOKENS = estimateTokens(JSON.stringify(BOARD_TOOLS))

function listingMeta(listing: BoardListing): string {
  return listing.omitted
    ? `Large board — the ${listing.listed} most relevant of ${listing.listed + listing.omitted} cards were sent; counts are exact`
    : ''
}

const join = (...parts: string[]) => parts.filter(Boolean).join(' · ')

export async function runBoardSummary(env: BoardBubbleEnv): Promise<void> {
  const board = env.board()
  const facts = computeBoardFacts(board, env.now())
  const factsText = JSON.stringify(facts)
  const msg = newMessage({
    role: 'assistant', content: '', action: 'board_summary', streaming: true,
    meta: boardFactsHeader(facts), boardFacts: facts,
  })
  env.sink.add(msg)

  const overhead = messagesTokens(boardSummaryMessages(factsText, ''))
  const listing = boardListing(board, '', pageAllowance(env.budget, overhead))
  const extra = listingMeta(listing)
  if (extra) env.sink.patch(msg.id, (m) => ({ ...m, meta: join(m.meta ?? '', extra) }))

  const { stopped } = await streamInto(env, msg.id, boardSummaryMessages(factsText, listing.text), GEN.summary)
  if (stopped) env.sink.patch(msg.id, (m) => ({ ...m, meta: join(m.meta ?? '', 'Stopped') }))
}

export async function runBoardQuestion(env: BoardBubbleEnv, question: string): Promise<void> {
  const board = env.board()
  const factsText = JSON.stringify(computeBoardFacts(board, env.now()))
  const turns = env.history()
  const msg = newMessage({ role: 'assistant', content: '', action: 'board_question', streaming: true })
  env.sink.add(msg)

  const overhead = messagesTokens(boardQuestionMessages(factsText, '', [], question))
  const listing = boardListing(board, question, pageAllowance(env.budget, overhead, turns))
  const meta = listingMeta(listing)
  if (meta) env.sink.patch(msg.id, (m) => ({ ...m, meta }))
  const used = overhead + estimateTokens(listing.text) + 4
  const history = fitTurns(turns, usableBudget(env.budget) - used)

  const { stopped } = await streamInto(env, msg.id,
    boardQuestionMessages(factsText, listing.text, history, question), GEN.question)
  if (stopped) env.sink.patch(msg.id, (m) => ({ ...m, meta: join(m.meta ?? '', 'Stopped') }))
}

function planIntro(actions: PlanAction[]): string {
  const ok = actions.filter((a) => a.resolved).length
  const bad = actions.length - ok
  const head = ok
    ? `${ok} change${ok === 1 ? '' : 's'} to review — nothing changes until you apply.`
    : 'Nothing here can be applied.'
  return bad ? `${head} ${bad} couldn't be matched to this board.` : head
}

/** Asks the model for tool calls and turns them into a plan card. Writes nothing. */
export async function runBoardPlan(env: BoardBubbleEnv, request: string): Promise<void> {
  const now = env.now()
  const today = isoDate(now)
  // Relative dates are resolved here, in code, before the model sees the message.
  const annotated = annotateRelativeDates(request, now)
  const overhead = messagesTokens(boardPlanMessages('', today, annotated)) + TOOLS_TOKENS
  const listing = boardListing(env.board(), request, pageAllowance(env.budget, overhead))

  env.sink.progress('Planning changes…')
  const calls = await env.provider.callTools(boardPlanMessages(listing.text, today, annotated), BOARD_TOOLS, GEN.plan)
  env.sink.progress(null)
  if (env.isStopped()) return

  // Validated against the board as it is now — it may have changed while the model worked.
  const actions = planFromToolCalls(calls, env.board())
  if (actions === null) {
    notice(env, `That would be ${calls.length} changes — more than ${MAX_PLAN_ACTIONS} at once. Narrow it down, e.g. one column or one tag at a time.`)
    return
  }
  if (!actions.length) {
    notice(env, 'No changes were proposed. Try naming the card and the column, e.g. "Move KAI-4 to Done".')
    return
  }
  env.sink.add(newMessage({
    role: 'assistant',
    action: 'board_plan',
    content: planIntro(actions),
    meta: listingMeta(listing) || undefined,
    usage: env.provider.lastUsage() ?? undefined,
    plan: { actions, selected: actions.filter((a) => a.resolved).map((a) => a.id), state: 'pending' },
  }))
}

/** A free-text message: the model picks the intent from the message alone. */
export async function runBoardMessage(env: BoardBubbleEnv, text: string): Promise<void> {
  const intent = await routeBoardIntent(env.provider, text)
  if (env.isStopped()) return
  switch (intent.kind) {
    case 'summarize': return runBoardSummary(env)
    case 'change': return runBoardPlan(env, text)
    case 'question': return runBoardQuestion(env, text)
  }
}
