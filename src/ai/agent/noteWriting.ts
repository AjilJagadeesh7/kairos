/**
 * Rewrite-selection and continue: both stream a proposal, then preview it in
 * the editor. Nothing reaches the note until the user presses Accept.
 */
import { estimateTokens, charsForTokens } from '../text/tokens'
import { cleanProposal } from '../text/clean'
import { messagesTokens, pageAllowance, usableBudget } from './budget'
import { continueMessages, rewriteMessages } from '../prompts/noteBubble.v1'
import { GEN, fitText, newMessage, notice, streamInto } from './bubbleEnv'
import type { BubbleEnv, EditorSelectionSnapshot, RewriteStyle } from '../../types'

/** Largest selection that can be rewritten in one request (input + output must fit). */
export function maxRewriteTokens(budget: number): number {
  const overhead = messagesTokens(rewriteMessages('', 'shorter', true))
  return Math.floor((usableBudget(budget) - overhead) / 2.6)
}

export async function runRewrite(env: BubbleEnv, style: RewriteStyle, sel: EditorSelectionSnapshot, retry = false): Promise<void> {
  const tokens = estimateTokens(sel.markdown)
  const limit = maxRewriteTokens(env.budget)
  if (tokens > limit) {
    notice(env, `The selection is too long to rewrite in one go (about ${tokens.toLocaleString('en-US')} tokens; this provider allows about ${limit.toLocaleString('en-US')}). Select a smaller part.`)
    return
  }

  const msg = newMessage({
    role: 'assistant', content: '', action: 'rewrite', streaming: true,
    suggestion: { kind: 'replace', style, original: sel.markdown, originalText: sel.text, proposed: '', state: 'pending' },
  })
  env.sink.add(msg)
  const { text, stopped } = await streamInto(env, msg.id, rewriteMessages(sel.markdown, style, retry), GEN.rewrite(tokens, retry))
  const proposed = cleanProposal(text, sel.markdown)

  if (stopped || !proposed || proposed.trim() === sel.markdown.trim()) {
    env.sink.patch(msg.id, (m) => ({
      ...m,
      content: stopped ? m.content : (proposed ? 'No changes suggested — the text already reads that way.' : 'The model returned nothing.'),
      suggestion: m.suggestion?.kind === 'replace' ? { ...m.suggestion, proposed, state: 'rejected' } : m.suggestion,
      meta: stopped ? 'Stopped' : m.meta,
    }))
    return
  }
  env.sink.patch(msg.id, (m) => ({
    ...m,
    content: proposed,
    suggestion: m.suggestion?.kind === 'replace' ? { ...m.suggestion, proposed } : m.suggestion,
  }))
  env.bridge.showPreview({ from: sel.from, to: sel.to }, sel.text, proposed)
}

/** The tail of `text` within `tokens`, starting at a paragraph break when possible. */
function tail(text: string, tokens: number): string {
  const max = charsForTokens(tokens)
  if (text.length <= max) return text
  const cut = text.slice(text.length - max)
  const para = cut.indexOf('\n\n')
  return para !== -1 && para < cut.length / 2 ? cut.slice(para + 2) : cut
}

export async function runContinue(env: BubbleEnv, pos?: number): Promise<void> {
  const point = env.bridge.continuePoint(pos)
  if (!point) {
    notice(env, 'Click in the note where the new paragraph should go, then try again.')
    return
  }
  const note = env.note()
  const title = note.title || 'Untitled'
  const msg = newMessage({
    role: 'assistant', content: '', action: 'continue', streaming: true,
    suggestion: { kind: 'insert', pos: point.pos, proposed: '', state: 'pending' },
  })
  env.sink.add(msg)

  // Recent text verbatim; anything earlier that doesn't fit is condensed, not cut.
  const overhead = messagesTokens(continueMessages(title, '', 'x'))
  const allowance = pageAllowance(env.budget, overhead)
  let recent = point.before
  let earlier: string | null = null
  if (estimateTokens(point.before) > allowance) {
    recent = tail(point.before, Math.floor(allowance * 0.5))
    const head = point.before.slice(0, point.before.length - recent.length)
    const condensed = await fitText(env, title, head, allowance - estimateTokens(recent))
    earlier = condensed.text
    env.sink.patch(msg.id, (m) => ({ ...m, meta: `Long note — earlier text condensed in ${condensed.parts} parts first` }))
  }

  const { text, stopped } = await streamInto(env, msg.id, continueMessages(title, recent, earlier), GEN.continue)
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
  env.sink.patch(msg.id, (m) => ({
    ...m,
    content: proposed,
    suggestion: m.suggestion?.kind === 'insert' ? { ...m.suggestion, proposed } : m.suggestion,
  }))
  env.bridge.showPreview({ from: point.pos, to: point.pos }, '', proposed)
}
