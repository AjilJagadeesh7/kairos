/**
 * The permission layer for note edits. When the bubble answers a message
 * instead of editing it — the model didn't pick an edit, or said it can't —
 * and the user evidently wants the note changed, the reply becomes an offer.
 * "Allow edit" runs the edit with the user's own words; "Always allow" lets
 * later change requests in the chat go straight to the edit. Permission only
 * lets the model propose: every edit is still previewed and needs Accept.
 *
 * Only the user's own words can skip the offer (PRD: note content can't
 * trigger actions). A marker or refusal in the model's reply — which note
 * text could influence — at most shows the offer for the user to decide.
 */

/** The model ends a reply with this line to offer an edit (questionMessages asks it to). */
export const OFFER_MARKER = '[offer-edit]'

const QUESTION = /^\s*(what|what's|whats|why|how|who|when|where|which|is|are|was|were|does|did|explain|tell me|describe|should)\b/i
const POLITE = /^\s*(please|pls|can you|could you|would you|will you|can u)\b/i
const CHANGE = new RegExp([
  'improve', 're-?format', 'format(?:ting)?', 'rewrite', 're-?word', 'rephrase', 'simplify', 'shorten', 'tighten', 'expand',
  'clean(?:\\s+(?:it|this|that))?\\s+up', 'fix', 'correct', 'proofread', 'restructure', 'reorgani[sz]e', 'organi[sz]e', 'convert',
  'turn\\b.{0,40}\\binto', 'make\\s+(?:it|this|that|the|them|these)\\b', 'change', 'edit', 'update', 'translate', 'add', 'remove',
  'replace', 'insert', 'append', 'bullet(?:s|ize)?', 'tabulate', 'sort', 'merge', 'split', 'polish', 'tidy',
].map((w) => `\\b${w}\\b`).join('|'), 'i')

/** The user asked for the note to change (not a question about it). */
export function looksLikeChange(instruction: string): boolean {
  const s = instruction.trim()
  if (QUESTION.test(s) && !POLITE.test(s)) return false
  return CHANGE.test(s)
}

const REFUSAL = /\b(?:can(?:no|['’])?t|unable to|not able to|(?:don['’]?t|do not) have (?:access|the ability|a way|permission)|no (?:way|ability) to)\b[^.!?\n]{0,80}\b(?:edit|chang|modif|format|updat|rewrit|alter|writ|access)/i

/** "I don't have access to the note's formatting or a way to change it." */
export function isRefusal(reply: string): boolean {
  return REFUSAL.test(reply)
}

/** The reply without the offer marker. */
export function stripOfferMarker(reply: string): string {
  return reply.split(OFFER_MARKER).join('').trim()
}

const YES = /^\s*(y|yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|please do|go for it|sounds good|allow|apply it)\b[\s.,!]*(please|thanks|thank you)?[\s.,!]*$/i

/** A short "yes" typed in reply to an offer. */
export function isAffirmative(text: string): boolean {
  return YES.test(text)
}

export type OfferDecision =
  /** Nothing to offer: keep the reply (minus a stray marker). */
  | { kind: 'none'; content: string }
  /** Show the offer card under the reply. */
  | { kind: 'offer'; content: string }
  /** Edits are allowed for this chat and the user asked for a change: edit now. */
  | { kind: 'edit'; content: string }

const REFUSAL_REPLACEMENT = 'I can make that change in the note.'

export function decideOffer(instruction: string, reply: string, editsAllowed: boolean): OfferDecision {
  const marker = reply.includes(OFFER_MARKER)
  const refusal = isRefusal(reply)
  const request = looksLikeChange(instruction)
  const cleaned = stripOfferMarker(reply)
  if (!marker && !refusal && !request) return { kind: 'none', content: cleaned }
  const content = refusal || !cleaned ? REFUSAL_REPLACEMENT : cleaned
  return { kind: request && editsAllowed ? 'edit' : 'offer', content }
}
