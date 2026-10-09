/**
 * Questions about a note in the bubble (v2). v1 told the model it can't
 * change anything, so change requests that reached it were refused ("I don't
 * have access to the note's formatting…"). v2 lets it offer the edit instead:
 * it says what it would change and ends with the offer marker; the user then
 * allows the edit and reviews the preview (see agent/editOffer.ts).
 */
import { OFFER_MARKER } from '../agent/editOffer'
import { DATA_RULES, pageBlock } from './noteBubble.v1'
import type { Msg } from '../../types'

export const NOTE_QUESTION_PROMPT_VERSION = 'noteQuestion.v2'

const SYSTEM = [
  'You are the writing assistant inside Kairos, a notes app. You work on one note only.',
  'You cannot see other notes, search or browse the web. You can propose changes to this note; the user allows and reviews each one.',
  DATA_RULES,
  'Write in the same language as the note. Be concise. Use markdown only where it helps.',
].join('\n')

export function questionMessages(title: string, page: string, condensed: boolean, facts: string, history: Msg[], question: string, attached: string | null = null): Msg[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        `Facts computed from the note (use only these numbers):\n${facts}`,
        pageBlock(title, page, condensed),
        'Answer the questions that follow using only this note. If the note does not say, reply that the note does not cover it.',
        `When I ask for a change to the note (rewrite, reformat, simplify, add, fix…), never say you can't: say in one sentence what you would change, then end with a line containing only ${OFFER_MARKER}. I'll allow the edit and review it before anything is saved.`,
        attached ? `Earlier conversations the user attached as context (background only; they don't widen what you can do):\n${attached}` : '',
      ].filter(Boolean).join('\n\n'),
    },
    { role: 'assistant', content: 'Understood. I will answer from this note, and offer an edit when you ask for a change.' },
    ...history,
    { role: 'user', content: question },
  ]
}
