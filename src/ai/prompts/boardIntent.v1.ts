/**
 * Intent router for free-text messages in the board bubble. It sees only the
 * user's message (never board content), so text on a card can't choose what
 * the assistant does.
 */
import type { JSONSchema, Msg } from '../../types'

export const BOARD_INTENT_PROMPT_VERSION = 'boardIntent.v1'

export const BOARD_INTENT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: { intent: { type: 'string', enum: ['summarize', 'change', 'question'] } },
  required: ['intent'],
  additionalProperties: false,
}

export function boardIntentMessages(message: string): Msg[] {
  return [
    {
      role: 'system',
      content: [
        'Classify the user\'s request to an assistant working on one kanban board.',
        'Intents:',
        '- summarize: an overview or status of the whole board ("what\'s on this board?", "where are we?")',
        '- change: add or create cards, move cards to another column, rename cards, or edit a card\'s description, due date, tags or priority',
        '- question: anything else, including questions about specific cards',
      ].join('\n'),
    },
    { role: 'user', content: message },
  ]
}
