/**
 * "Add context": earlier conversations attached to a chat or bubble go into
 * the prompt as a delimited data block — a trimmed transcript, or a summary
 * when even the trimmed one doesn't fit (PRD). Attaching never widens what a
 * surface may do; it only adds text.
 */
import { estimateTokens } from '../text/tokens'
import { dataBlock } from '../text/dataBlock'
import type { AiChatRecord } from '../../types'

/** Share of the prompt budget attached conversations may use. */
export const ATTACH_SHARE = 0.25

export function transcript(record: AiChatRecord): string {
  return record.messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.trim()}${m.outcome ? ` [${m.outcome}]` : ''}`)
    .join('\n')
}

/** The most recent lines of `text` that fit in `tokens`, marked as trimmed. */
export function trimToLatest(text: string, tokens: number): { text: string; kept: number; total: number } {
  const lines = text.split('\n')
  const out: string[] = []
  let used = 0
  for (let i = lines.length - 1; i >= 0; i--) {
    const cost = estimateTokens(lines[i]) + 1
    if (used + cost > tokens) break
    out.unshift(lines[i])
    used += cost
  }
  const dropped = lines.length - out.length
  return { text: dropped ? `(${dropped} earlier lines left out)\n${out.join('\n')}` : out.join('\n'), kept: out.length, total: lines.length }
}

/**
 * The attached conversations, fitted into `maxTokens`. A conversation that
 * loses more than half its lines to trimming is summarized instead (via
 * `summarize`, which map-reduces it), so its gist survives.
 */
export async function attachedContextBlock(
  records: AiChatRecord[],
  maxTokens: number,
  summarize: (title: string, text: string, target: number) => Promise<string>,
): Promise<string | null> {
  if (!records.length) return null
  const share = Math.max(80, Math.floor(maxTokens / records.length) - 30)
  const parts: string[] = []
  for (const r of records) {
    const full = transcript(r)
    const date = r.updatedAt.slice(0, 10)
    let body = full
    if (estimateTokens(full) > share) {
      const trimmed = trimToLatest(full, share)
      body = trimmed.kept * 2 >= trimmed.total ? trimmed.text : `(summary)\n${await summarize(r.title, full, share)}`
    }
    parts.push(`## ${r.title} (${date})\n${body}`)
  }
  return dataBlock('earlier_conversations', parts.join('\n\n'))
}
