/** Routes a free-text board-bubble message to one intent. Sees only the message. */
import { BOARD_INTENT_SCHEMA, boardIntentMessages } from '../prompts/boardIntent.v1'
import { ProviderError } from '../providers/errors'
import type { BoardIntent, LLMProvider } from '../../types'

export function boardIntentFromJSON(raw: { intent?: string }): BoardIntent {
  return raw.intent === 'summarize' || raw.intent === 'change' ? { kind: raw.intent } : { kind: 'question' }
}

/**
 * Asks the model for the intent. Provider errors propagate; output that stays
 * invalid after the adapter's retry falls back to a question (which can't write).
 */
export async function routeBoardIntent(provider: LLMProvider, message: string): Promise<BoardIntent> {
  try {
    const raw = await provider.generateJSON<{ intent?: string }>(
      boardIntentMessages(message), BOARD_INTENT_SCHEMA, { maxTokens: 40, temperature: 0, thinking: false })
    return boardIntentFromJSON(raw)
  } catch (err) {
    if (err instanceof ProviderError && err.kind === 'invalid_output') return { kind: 'question' }
    throw err
  }
}
