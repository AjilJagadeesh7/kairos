/** Routes a global-chat message to one intent. Sees only the message. */
import { GLOBAL_INTENT_SCHEMA, globalIntentMessages } from '../prompts/globalChat.v1'
import { ProviderError } from '../providers/errors'
import type { GlobalIntent, LLMProvider, ReviewPeriod } from '../../types'

interface RawIntent { intent?: string; period?: string; since?: string; tags?: unknown }

const PERIODS: ReviewPeriod[] = ['day', 'week', 'month']

export function globalIntentFromJSON(raw: RawIntent): GlobalIntent {
  switch (raw.intent) {
    case 'pending': return { kind: 'pending' }
    case 'review': return { kind: 'review', period: PERIODS.includes(raw.period as ReviewPeriod) ? raw.period as ReviewPeriod : 'week' }
    case 'change': return { kind: 'change' }
    case 'chitchat': return { kind: 'chitchat' }
    default: return {
      kind: 'query',
      since: PERIODS.includes(raw.since as ReviewPeriod) ? raw.since as ReviewPeriod : null,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string').map((t) => t.replace(/^#/, '')) : [],
    }
  }
}

/** Output that stays invalid after the adapter's retry falls back to a plain query. */
export async function routeGlobalIntent(provider: LLMProvider, message: string): Promise<GlobalIntent> {
  try {
    const raw = await provider.generateJSON<RawIntent>(
      globalIntentMessages(message), GLOBAL_INTENT_SCHEMA, { maxTokens: 80, temperature: 0, thinking: false })
    return globalIntentFromJSON(raw)
  } catch (err) {
    if (err instanceof ProviderError && err.kind === 'invalid_output') return { kind: 'query', since: null, tags: [] }
    throw err
  }
}
