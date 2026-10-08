/** Helpers shared by the note-bubble action runners. */
import { v4 as uuid } from 'uuid'
import { estimateTokens } from '../text/tokens'
import { stripThinking } from '../text/clean'
import { condenseToFit } from './condense'
import { pageAllowance } from './budget'
import type { BubbleEnv, BubbleMessage, Condensed, GenOpts, Msg } from '../../types'

export const GEN = {
  summary:  { maxTokens: 600, temperature: 0.3, thinking: false },
  continue: { maxTokens: 400, temperature: 0.7, thinking: false },
  json:     { maxTokens: 200, temperature: 0.3, thinking: false },
  question: { maxTokens: 800, temperature: 0.4, thinking: false },
  rewrite:  (inputTokens: number, retry: boolean): GenOpts => ({
    maxTokens: Math.min(4096, Math.ceil(inputTokens * 1.6) + 100),
    temperature: retry ? 0.8 : 0.4,
    thinking: false,
  }),
} satisfies Record<string, GenOpts | ((...a: never[]) => GenOpts)>

export function newMessage(message: Omit<BubbleMessage, 'id' | 'createdAt'>): BubbleMessage {
  return { id: uuid(), createdAt: new Date().toISOString(), ...message }
}

export function notice(env: BubbleEnv, content: string): void {
  env.sink.add(newMessage({ role: 'notice', content }))
}

/** Small, stable hash so the condense cache isn't keyed by whole notes. */
function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return `${text.length}:${(h >>> 0).toString(36)}`
}

/** `text` as-is when it fits in `target` tokens, otherwise map-reduce condensed. */
export async function fitText(env: BubbleEnv, title: string, text: string, target: number): Promise<Condensed> {
  if (estimateTokens(text) <= target) return { text, condensed: false, parts: 1 }
  const key = `${target}:${hash(text)}`
  const cached = env.cache.get(key)
  if (cached) return cached
  try {
    const result = await condenseToFit(env.provider, title, text, {
      budget: env.budget,
      target,
      isStopped: env.isStopped,
      onProgress: (done, total) => env.sink.progress(
        done < total ? `Long note — condensing part ${done + 1} of ${total}…` : 'Writing…'),
    })
    env.cache.set(key, result)
    return result
  } finally {
    env.sink.progress(null)
  }
}

/** The current page, fitted to what's left after `overhead` tokens and recent turns. */
export function fitPage(env: BubbleEnv, overhead: number, turns: Msg[] = []): Promise<Condensed> {
  const note = env.note()
  return fitText(env, note.title || 'Untitled', note.content, pageAllowance(env.budget, overhead, turns))
}

export function condensedMeta(page: Condensed): string {
  return page.condensed ? `Long note — condensed in ${page.parts} parts first, nothing skipped` : ''
}

/**
 * Streams a reply into message `id`. Resolves with the full text (reasoning
 * stripped) and whether the user stopped it.
 */
export async function streamInto(env: BubbleEnv, id: string, messages: Msg[], opts: GenOpts): Promise<{ text: string; stopped: boolean }> {
  let raw = ''
  for await (const delta of env.provider.generate(messages, opts)) {
    raw += delta
    const shown = stripThinking(raw)
    env.sink.patch(id, (m) => ({ ...m, content: shown }))
  }
  const stopped = env.isStopped()
  const usage = env.provider.lastUsage() ?? undefined
  env.sink.patch(id, (m) => ({ ...m, streaming: false, usage }))
  return { text: stripThinking(raw), stopped }
}
