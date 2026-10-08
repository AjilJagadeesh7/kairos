/**
 * Map-reduce for text longer than the prompt budget: split on headings,
 * condense each part in its own request, join the results in order, and
 * repeat if the joined text is still too long. Nothing is silently cut.
 */
import { chunkMarkdown } from '../text/chunk'
import { estimateTokens } from '../text/tokens'
import { stripThinking } from '../text/clean'
import { condenseMessages } from '../prompts/condense.v1'
import { messagesTokens } from './budget'
import { ProviderError } from '../providers/errors'
import type { Condensed, LLMProvider } from '../../types'

/** Rounds of condensing before giving up on fitting the budget. */
const MAX_ROUNDS = 3
const MIN_PART_WORDS = 60
const MAX_PART_WORDS = 300

export interface CondenseOptions {
  /** Prompt budget of one request. */
  budget: number
  /** The result must fit in this many tokens. */
  target: number
  isStopped: () => boolean
  onProgress?: (done: number, total: number) => void
}

/** Thrown when the user pressed Stop during a multi-request job. */
export class StoppedError extends Error {
  constructor() { super('Stopped'); this.name = 'StoppedError' }
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let text = ''
  for await (const delta of stream) text += delta
  return text
}

export async function condenseToFit(
  provider: LLMProvider, title: string, markdown: string, opts: CondenseOptions,
): Promise<Condensed> {
  if (estimateTokens(markdown) <= opts.target) return { text: markdown, condensed: false, parts: 1 }

  let text = markdown
  let firstParts = 0
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const overhead = messagesTokens(condenseMessages(title, '', 'x'.repeat(80), 99, 99, MAX_PART_WORDS))
    const outputReserve = Math.ceil(MAX_PART_WORDS * 1.5)
    const chunkMax = Math.max(300, Math.floor(opts.budget * 0.9) - overhead - outputReserve)
    const chunks = chunkMarkdown(text, chunkMax)
    if (round === 0) firstParts = chunks.length

    // Spread the target over the parts, in words (≈ 0.75 words per token).
    const words = Math.round(Math.min(MAX_PART_WORDS, Math.max(MIN_PART_WORDS, (opts.target * 0.75) / chunks.length)))
    const parts: string[] = []
    for (let i = 0; i < chunks.length; i++) {
      if (opts.isStopped()) throw new StoppedError()
      opts.onProgress?.(i, chunks.length)
      const c = chunks[i]
      const out = await collect(provider.generate(
        condenseMessages(title, c.text, c.heading, i, chunks.length, words),
        { maxTokens: Math.ceil(words * 2), temperature: 0.2, thinking: false },
      ))
      if (opts.isStopped()) throw new StoppedError()
      parts.push(`### Part ${i + 1}${c.heading ? ` — ${c.heading}` : ''}\n${stripThinking(out).trim()}`)
    }
    opts.onProgress?.(chunks.length, chunks.length)

    text = parts.join('\n\n')
    if (estimateTokens(text) <= opts.target) return { text, condensed: true, parts: firstParts }
  }
  throw new ProviderError(
    'invalid_output',
    "This note is too long to summarize within this provider's context budget. Raise the context size in Settings → AI, or select a part of the note.",
  )
}
