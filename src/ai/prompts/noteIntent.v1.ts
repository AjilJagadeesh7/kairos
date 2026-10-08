/**
 * Intent router for free-text messages in the note bubble. It sees only the
 * user's message (never note content), so text inside a note can't choose
 * what the assistant does.
 */
import type { JSONSchema, Msg } from '../../types'

export const NOTE_INTENT_PROMPT_VERSION = 'noteIntent.v1'

export const NOTE_INTENT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: ['summarize', 'rewrite', 'continue', 'suggest_title', 'suggest_tags', 'extract_tasks', 'question'],
    },
    style: { type: 'string', enum: ['shorter', 'formal', 'casual', 'grammar'] },
  },
  required: ['intent'],
  additionalProperties: false,
}

export function noteIntentMessages(message: string, hasSelection: boolean): Msg[] {
  return [
    {
      role: 'system',
      content: [
        'Classify the user\'s request to a writing assistant working on one note.',
        'Intents:',
        '- summarize: summarize the note',
        '- rewrite: change the selected text; style is shorter (tighten/shorten), formal, casual, or grammar (fix spelling/grammar)',
        '- continue: write the next paragraph',
        '- suggest_title: propose a title',
        '- suggest_tags: propose tags',
        '- extract_tasks: turn the note into tasks or cards',
        '- question: anything else, including questions about the note',
        hasSelection
          ? 'The user has text selected in the note.'
          : 'The user has no text selected, so rewrite is unlikely unless they ask to rewrite the whole thing.',
      ].join('\n'),
    },
    { role: 'user', content: message },
  ]
}
