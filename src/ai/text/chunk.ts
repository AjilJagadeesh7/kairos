/**
 * Splits markdown into chunks of at most `maxTokens`, on heading boundaries
 * first, then paragraphs, then sentences. Nothing is dropped: every non-blank
 * line of the input lands in exactly one chunk, in order.
 */
import { charsForTokens, estimateTokens } from './tokens'

export interface TextChunk {
  /** Heading path, e.g. "Plan › Risks". Empty before the first heading. */
  heading: string
  text: string
  tokens: number
}

interface Section { heading: string; lines: string[] }

const HEADING = /^(#{1,6})\s+(.*)$/
const FENCE = /^\s*(```|~~~)/

function sections(markdown: string): Section[] {
  const out: Section[] = [{ heading: '', lines: [] }]
  const path: string[] = []
  let fence: string | null = null
  for (const line of markdown.split('\n')) {
    const f = line.match(FENCE)
    if (f) fence = fence === null ? f[1] : (fence === f[1] ? null : fence)
    const h = fence === null && !f ? line.match(HEADING) : null
    if (h) {
      path.length = h[1].length - 1
      path[h[1].length - 1] = h[2].trim()
      out.push({ heading: path.filter(Boolean).join(' › '), lines: [line] })
    } else {
      out[out.length - 1].lines.push(line)
    }
  }
  return out.filter((s) => s.lines.some((l) => l.trim()))
}

/** Paragraphs separated by blank lines, keeping fenced code blocks whole. */
function paragraphs(text: string): string[] {
  const out: string[] = []
  let current: string[] = []
  let inFence = false
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) inFence = !inFence
    if (!inFence && !line.trim()) {
      if (current.length) out.push(current.join('\n'))
      current = []
    } else {
      current.push(line)
    }
  }
  if (current.length) out.push(current.join('\n'))
  return out
}

/** Last resort for a single paragraph over the limit: sentences, then hard cuts. */
function splitLong(text: string, maxTokens: number): string[] {
  const sentences = (text.match(/[^.!?\n]*(?:[.!?]+\s*|\n|$)/g) ?? [text]).filter(Boolean)
  const pieces = pack(sentences, maxTokens, '')
  const maxChars = charsForTokens(maxTokens)
  return pieces.flatMap((p) => {
    if (estimateTokens(p) <= maxTokens) return [p]
    const cuts: string[] = []
    for (let i = 0; i < p.length; i += maxChars) cuts.push(p.slice(i, i + maxChars))
    return cuts
  })
}

/** Greedily joins parts while the result stays within `maxTokens`. */
function pack(parts: string[], maxTokens: number, sep: string): string[] {
  const out: string[] = []
  let current = ''
  for (const part of parts) {
    const joined = current ? current + sep + part : part
    if (current && estimateTokens(joined) > maxTokens) {
      out.push(current)
      current = part
    } else {
      current = joined
    }
  }
  if (current) out.push(current)
  return out
}

export function chunkMarkdown(markdown: string, maxTokens: number): TextChunk[] {
  const pieces: Array<{ heading: string; text: string }> = []
  for (const s of sections(markdown)) {
    const text = s.lines.join('\n').trim()
    if (estimateTokens(text) <= maxTokens) {
      pieces.push({ heading: s.heading, text })
      continue
    }
    const paras = paragraphs(text).flatMap((p) =>
      estimateTokens(p) <= maxTokens ? [p] : splitLong(p, maxTokens))
    for (const t of pack(paras, maxTokens, '\n\n')) pieces.push({ heading: s.heading, text: t })
  }

  // Merge small neighbours so a note with many short sections isn't one call each.
  const merged: TextChunk[] = []
  for (const p of pieces) {
    const last = merged[merged.length - 1]
    const joined = last ? `${last.text}\n\n${p.text}` : ''
    if (last && estimateTokens(joined) <= maxTokens) {
      last.text = joined
      last.tokens = estimateTokens(joined)
    } else {
      merged.push({ heading: p.heading, text: p.text, tokens: estimateTokens(p.text) })
    }
  }
  return merged
}
