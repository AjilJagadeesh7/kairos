/**
 * Deciding what the note bubble does with a message (v2). Like v1 it sees
 * only the user's instruction and whether text is selected — never the note —
 * so note content can't steer which action runs (PRD). v2 says plainly that
 * the note can be changed (every change is previewed), and maps "improve /
 * format / simplify" requests to edit_text, which small models missed.
 */
import type { Msg } from '../../types'

export const NOTE_DECIDE_PROMPT_VERSION = 'noteDecide.v2'

export function decideMessages(instruction: string, hasSelection: boolean): Msg[] {
  return [
    {
      role: 'system',
      content: [
        'You are the assistant in a note-taking app, working on the one note the user has open.',
        'You can change this note: every change is shown to the user as a preview to accept or reject, so never refuse a change.',
        'Call exactly one tool when the user wants the note changed or one of those actions:',
        '- edit_text: improve, format, reformat, simplify, clean up, restructure, shorten, expand, fix, translate or rewrite existing text ("make it simpler", "improve the format", "turn this into a table").',
        '- insert_text: write something new into the note ("add a conclusion", "continue", "draft an intro").',
        'Call no tool when the user asks a question, wants an explanation or wants to talk about the note — that is answered in the chat.',
        hasSelection ? 'The user has text selected in the note.' : 'No text is selected, so edits apply to the whole note.',
      ].join('\n'),
    },
    { role: 'user', content: instruction },
  ]
}
