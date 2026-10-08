/**
 * Saved AI conversations. Bubble sessions are written when the bubble is
 * closed or cleared; the chat page (P4) lists them read-only. Device-local:
 * the table is never mirrored to the vault or a sync provider.
 */
import { db } from '../../db/schema'
import type { AiChatMessage, AiChatRecord, AiChatSource, BubbleMessage, BubbleSuggestion } from '../../types'

export function bubbleChatTitle(pageTitle: string): string {
  return `Bubble · ${pageTitle.trim() || 'Untitled'}`
}

function outcome(s: BubbleSuggestion | undefined): string | undefined {
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
  return m.content
}

/** Converts a bubble transcript; null when nothing was asked (nothing to save). */
export function bubbleChatRecord(params: {
  id: string
  source: AiChatSource
  provider: AiChatRecord['provider']
  messages: BubbleMessage[]
  createdAt: string
  now?: string
}): AiChatRecord | null {
  const now = params.now ?? new Date().toISOString()
  const messages: AiChatMessage[] = params.messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && content(m).trim())
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: content(m),
      createdAt: m.createdAt,
      ...(m.action ? { action: m.action } : {}),
      ...(outcome(m.suggestion) ? { outcome: outcome(m.suggestion) } : {}),
    }))
  if (!messages.some((m) => m.role === 'user')) return null
  return {
    id: params.id,
    surface: 'bubble',
    title: bubbleChatTitle(params.source.title),
    source: params.source,
    attachedChatIds: [],
    provider: params.provider,
    messages,
    createdAt: params.createdAt,
    updatedAt: now,
  }
}

export async function saveChat(record: AiChatRecord): Promise<void> {
  await db.aiChats.put(record)
}
