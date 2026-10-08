/**
 * Prompt-token budget. Order of priority (PRD): system prompt → facts →
 * current page → last 4 chat turns. The page is never cut to make room —
 * when it doesn't fit it is condensed (map-reduce) instead.
 */
import { estimateTokens } from '../text/tokens'
import type { AiProviderConfig, Msg } from '../../types'

export const DEFAULT_PROMPT_BUDGET = 8_000
export const MAX_PROMPT_BUDGET = 32_000
export const MIN_PROMPT_BUDGET = 2_000
export const MAX_HISTORY_TURNS = 4

/** Share of the budget held back for chat turns, when there are any. */
const HISTORY_SHARE = 0.15
/** Headroom for chat-template tokens the estimate can't see. */
const SAFETY_SHARE = 0.08

/** Prompt tokens for a custom provider: its configured window, capped at 32k. */
export function promptBudget(cfg: Pick<AiProviderConfig, 'contextTokens'>): number {
  const raw = cfg.contextTokens > 0 ? cfg.contextTokens : DEFAULT_PROMPT_BUDGET
  return Math.min(MAX_PROMPT_BUDGET, Math.max(MIN_PROMPT_BUDGET, raw))
}

export function messagesTokens(messages: Msg[]): number {
  return messages.reduce((n, m) => n + estimateTokens(m.content) + 4, 0)
}

/** The last `MAX_HISTORY_TURNS` turns, newest kept first, that fit in `tokens`. */
export function fitTurns(turns: Msg[], tokens: number): Msg[] {
  const kept: Msg[] = []
  let used = 0
  for (const turn of turns.slice(-MAX_HISTORY_TURNS).reverse()) {
    const cost = estimateTokens(turn.content) + 4
    if (used + cost > tokens) break
    kept.unshift(turn)
    used += cost
  }
  return kept
}

/**
 * Tokens left for the page after the fixed parts (`overhead`: system prompt,
 * facts, instruction and the user's message, measured by building the prompt
 * with an empty page) and a reserve for recent turns.
 */
export function pageAllowance(budget: number, overhead: number, turns: Msg[] = []): number {
  const historyReserve = Math.min(messagesTokens(turns.slice(-MAX_HISTORY_TURNS)), Math.floor(budget * HISTORY_SHARE))
  return Math.max(0, usableBudget(budget) - overhead - historyReserve)
}

/** The budget minus headroom for chat-template tokens. */
export function usableBudget(budget: number): number {
  return Math.floor(budget * (1 - SAFETY_SHARE))
}
