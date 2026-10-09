/**
 * Free-form edits of a note: rewrite the selection or the whole note, or
 * insert new text at the cursor / top / end, following the user's own words.
 * Each streams a proposal and previews it in the editor (struck / added);
 * nothing reaches the note until Accept.
 */
import { charsForTokens, estimateTokens } from '../text/tokens'
import { cleanProposal } from '../text/clean'
import { messagesTokens, pageAllowance, usableBudget } from './budget'
import { GEN, fitText, newMessage, notice, streamInto } from './bubbleEnv'
import { editMessages, insertMessages } from '../prompts/noteAgent.v1'
import type { BubbleEnv, EditorSelectionSnapshot } from '../../types'

/** Largest text that can be rewritten in one request (input + output must fit). */
export function maxEditTokens(budget: number): number {
  return Math.floor((usableBudget(budget) - messagesTokens(editMessages('', '', 'x'.repeat(200), true))) / 2.6)
}

export async function runEdit(env: BubbleEnv, instruction: string, target: EditorSelectionSnapshot, retry = false): Promise<void> {
  const tokens = estimateTokens(target.markdown)
  const limit = maxEditTokens(env.budget)
  if (tokens > limit) {
    notice(env, `That's too long to change in one go (about ${tokens.toLocaleString('en-US')} tokens; this provider allows about ${limit.toLocaleString('en-US')}). Select a part of the note and ask again.`)
    return
  }
  const msg = newMessage({
    role: 'assistant', content: '', action: 'rewrite', streaming: true,
    suggestion: { kind: 'replace', style: null, instruction, original: target.markdown, originalText: target.text, proposed: '', state: 'pending' },
  })
  env.sink.add(msg)
  const { text, stopped } = await streamInto(env, msg.id, editMessages(env.note().title || 'Untitled', target.markdown, instruction, retry), GEN.rewrite(tokens, retry))
  const proposed = cleanProposal(text, target.markdown)
  if (stopped || !proposed || proposed.trim() === target.markdown.trim()) {
    env.sink.patch(msg.id, (m) => ({
      ...m,
      content: stopped ? m.content : proposed ? 'No changes needed — the text already does that.' : 'The model returned nothing.',
      suggestion: m.suggestion?.kind === 'replace' ? { ...m.suggestion, proposed, state: 'rejected' } : m.suggestion,
      meta: stopped ? 'Stopped' : m.meta,
    }))
    return
  }
  env.sink.patch(msg.id, (m) => ({ ...m, content: proposed, suggestion: m.suggestion?.kind === 'replace' ? { ...m.suggestion, proposed } : m.suggestion }))
  env.bridge.showPreview({ from: target.from, to: target.to }, target.text, proposed)
}

/** The tail of `text` within `tokens`, starting at a paragraph break when possible. */
function tail(text: string, tokens: number): string {
  const max = charsForTokens(tokens)
  if (text.length <= max) return text
  const cut = text.slice(text.length - max)
  const para = cut.indexOf('\n\n')
  return para !== -1 && para < cut.length / 2 ? cut.slice(para + 2) : cut
}

export async function runInsert(env: BubbleEnv, instruction: string, at: 'cursor' | 'top' | 'end', pos?: number): Promise<void> {
  const point = pos !== undefined ? env.bridge.continuePoint(pos) : at === 'cursor' ? env.bridge.continuePoint() : env.bridge.edgePoint(at)
  if (!point) {
    notice(env, 'Click in the note where the new text should go, then try again.')
    return
  }
  const title = env.note().title || 'Untitled'
  const msg = newMessage({
    role: 'assistant', content: '', action: 'continue', streaming: true,
    suggestion: { kind: 'insert', pos: point.pos, instruction, proposed: '', state: 'pending' },
  })
  env.sink.add(msg)
  // Recent text verbatim; anything earlier that doesn't fit is condensed, not cut.
  const allowance = pageAllowance(env.budget, messagesTokens(insertMessages(title, '', 'x', instruction)))
  let recent = point.before
  let earlier: string | null = null
  if (estimateTokens(point.before) > allowance) {
    recent = tail(point.before, Math.floor(allowance * 0.5))
    const head = point.before.slice(0, point.before.length - recent.length)
    earlier = (await fitText(env, title, head, allowance - estimateTokens(recent))).text
  }
  const { text, stopped } = await streamInto(env, msg.id, insertMessages(title, recent, earlier, instruction), { ...GEN.continue, maxTokens: 1200 })
  const proposed = cleanProposal(text)
  if (stopped || !proposed) {
    env.sink.patch(msg.id, (m) => ({
      ...m,
      content: stopped ? m.content : 'The model returned nothing.',
      suggestion: m.suggestion?.kind === 'insert' ? { ...m.suggestion, proposed, state: 'rejected' } : m.suggestion,
      meta: stopped ? 'Stopped' : m.meta,
    }))
    return
  }
  env.sink.patch(msg.id, (m) => ({ ...m, content: proposed, suggestion: m.suggestion?.kind === 'insert' ? { ...m.suggestion, proposed } : m.suggestion }))
  env.bridge.showPreview({ from: point.pos, to: point.pos }, '', proposed)
}
