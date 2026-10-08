/**
 * Saved AI conversations. Bubble sessions are written when the bubble is
 * closed or cleared and are read-only afterwards; global threads are written
 * after every turn. Device-local: the table is never mirrored to the vault or
 * a sync provider. Retention lives in `chatStore.ts`.
 */
import { v4 as uuid } from 'uuid'
import type { AiChatMessage, AiChatRecord, AiChatSource, BoardPlan, BubbleMessage } from '../../types'

export function bubbleChatTitle(pageTitle: string): string {
  return `Bubble · ${pageTitle.trim() || 'Untitled'}`
}

/** A global thread is named after its first question. */
export function globalChatTitle(firstMessage: string): string {
  const flat = firstMessage.replace(/\s+/g, ' ').trim()
  return flat.length > 60 ? `${flat.slice(0, 59)}…` : flat || 'New chat'
}

function planOutcome(plan: Pick<BoardPlan, 'state' | 'appliedCount' | 'actions'>): string {
  switch (plan.state) {
    case 'pending': return 'not applied'
    case 'cancelled': return 'cancelled'
    case 'undone': return 'applied, then undone'
    case 'applied': return `applied ${plan.appliedCount ?? 0} of ${plan.actions.length}`
  }
}

function outcome(m: BubbleMessage): string | undefined {
  if (m.plan) return planOutcome(m.plan)
  if (m.taskPlan) {
    const t = m.taskPlan
    if (t.state === 'applied') return `created ${t.createdKeys?.join(', ') || `${t.appliedCount ?? 0} cards`}`
    return planOutcome({ state: t.state, actions: [] })
  }
  const s = m.suggestion
  if (!s) return undefined
  switch (s.kind) {
    case 'replace':
    case 'insert': return s.state === 'pending' ? 'not applied' : s.state
    case 'summary': return s.inserted ? 'inserted at top' : undefined
    case 'title': return s.applied ? `applied: ${s.applied}` : 'not applied'
    case 'tags': return s.applied ? `added: ${s.applied.join(', ')}` : 'not applied'
  }
}

function content(m: BubbleMessage): string {
  const s = m.suggestion
  if (s?.kind === 'title' || s?.kind === 'tags') return `${m.content} ${s.options.join(' · ')}`.trim()
  if (m.taskPlan) {
    const lines = m.taskPlan.tasks.map((t) => `- ${t.title}${t.unresolved ? ` (not used: ${t.unresolved})` : ''}`)
    return [m.content, ...lines].join('\n')
  }
  if (m.plan) {
    const lines = m.plan.actions.map((a) => `- ${a.summary}${a.unresolved ? ` (not applied: ${a.unresolved})` : ''}`)
    return [m.content, ...lines].join('\n')
  }
  return m.content
}

/** What gets saved: what was said and what happened, not notices or errors. */
export function toChatMessages(messages: BubbleMessage[]): AiChatMessage[] {
  return messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && (content(m).trim() || m.vaultFacts))
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: content(m),
      createdAt: m.createdAt,
      ...(m.action ? { action: m.action } : {}),
      ...(outcome(m) ? { outcome: outcome(m) } : {}),
      ...(m.meta ? { meta: m.meta } : {}),
      ...(m.vaultFacts ? { vaultFacts: m.vaultFacts } : {}),
      ...(m.sources?.length ? { sources: m.sources } : {}),
    }))
}

/** A saved message back as something the chat can render. */
export function fromChatMessage(m: AiChatMessage): BubbleMessage {
  return {
    id: uuid(), role: m.role, content: m.content, createdAt: m.createdAt,
    ...(m.action ? { action: m.action } : {}),
    ...(m.meta ? { meta: m.meta } : {}),
    ...(m.vaultFacts ? { vaultFacts: m.vaultFacts } : {}),
    ...(m.sources ? { sources: m.sources } : {}),
  }
}

/** Converts a session to a record; null when nothing was asked (nothing to save). */
export function chatRecord(params: {
  id: string
  surface: AiChatRecord['surface']
  /** Bubble: the page. Global: null. */
  source: AiChatSource | null
  provider: AiChatRecord['provider']
  messages: BubbleMessage[]
  attachedChatIds?: string[]
  createdAt: string
  now?: string
}): AiChatRecord | null {
  const messages = toChatMessages(params.messages)
  const first = messages.find((m) => m.role === 'user')
  if (!first) return null
  return {
    id: params.id,
    surface: params.surface,
    title: params.surface === 'bubble' ? bubbleChatTitle(params.source?.title ?? '') : globalChatTitle(first.content),
    source: params.source,
    attachedChatIds: params.attachedChatIds ?? [],
    provider: params.provider,
    messages,
    createdAt: params.createdAt,
    updatedAt: params.now ?? new Date().toISOString(),
  }
}

/** Bubble sessions (kept for callers and tests from P1/P2). */
export function bubbleChatRecord(params: {
  id: string
  source: AiChatSource
  provider: AiChatRecord['provider']
  messages: BubbleMessage[]
  createdAt: string
  now?: string
}): AiChatRecord | null {
  return chatRecord({ ...params, surface: 'bubble' })
}
