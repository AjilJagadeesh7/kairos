/** Routes a free-text bubble message to one intent. Sees only the message. */
import { NOTE_INTENT_SCHEMA, noteIntentMessages } from '../prompts/noteIntent.v1'
import { ProviderError } from '../providers/errors'
import type { LLMProvider, NoteIntent, RewriteStyle } from '../../types'

interface RawIntent { intent: string; style?: string }

const STYLES: RewriteStyle[] = ['shorter', 'formal', 'casual', 'grammar']

export function intentFromJSON(raw: RawIntent): NoteIntent {
  switch (raw.intent) {
    case 'summarize':
    case 'continue':
    case 'suggest_title':
    case 'suggest_tags':
    case 'extract_tasks':
      return { kind: raw.intent }
    case 'rewrite':
      return { kind: 'rewrite', style: STYLES.includes(raw.style as RewriteStyle) ? raw.style as RewriteStyle : 'shorter' }
    default:
      return { kind: 'question' }
  }
}

/**
 * Asks the model for the intent. Provider errors (network, auth…) propagate;
 * output that stays invalid after the adapter's retry falls back to a question.
 */
export async function routeNoteIntent(provider: LLMProvider, message: string, hasSelection: boolean): Promise<NoteIntent> {
  try {
    const raw = await provider.generateJSON<RawIntent>(
      noteIntentMessages(message, hasSelection),
      NOTE_INTENT_SCHEMA,
      { maxTokens: 60, temperature: 0, thinking: false },
    )
    return intentFromJSON(raw)
  } catch (err) {
    if (err instanceof ProviderError && err.kind === 'invalid_output') return { kind: 'question' }
    throw err
  }
}
