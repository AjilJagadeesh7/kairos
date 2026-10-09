/**
 * A small markdown parser for AI chat replies: headings, paragraphs, bullet
 * and numbered lists, fenced code, and inline bold / italic / code / links /
 * citations ([1]). Produces a plain tree that the UI renders as React
 * elements — never HTML — so model output can't inject markup.
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: Inline[] }
  | { t: 'cite'; n: number }

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'h'; level: number; c: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][]; start?: number }
  | { t: 'pre'; v: string }

const SAFE_URL = /^(https?:\/\/|mailto:)/i

/** Inline markdown → nodes. Unclosed markers stay as text (streaming-safe). */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let text = ''
  const flush = () => { if (text) { out.push({ t: 'text', v: text }); text = '' } }
  let i = 0
  while (i < src.length) {
    const rest = src.slice(i)
    let m: RegExpMatchArray | null
    if ((m = rest.match(/^`([^`\n]+)`/))) { flush(); out.push({ t: 'code', v: m[1] }); i += m[0].length; continue }
    if ((m = rest.match(/^\*\*([^*\n](?:[^*\n]|\*(?!\*))*?)\*\*/)) || (m = rest.match(/^__([^_\n]+?)__/))) {
      flush(); out.push({ t: 'strong', c: parseInline(m[1]) }); i += m[0].length; continue
    }
    if ((m = rest.match(/^\*([^*\s][^*\n]*?)\*/)) || (m = rest.match(/^_([^_\s][^_\n]*?)_(?![\p{L}\p{N}])/u))) {
      flush(); out.push({ t: 'em', c: parseInline(m[1]) }); i += m[0].length; continue
    }
    if ((m = rest.match(/^\[([^\]\n]+)\]\(([^)\s]+)\)/))) {
      flush()
      if (SAFE_URL.test(m[2])) out.push({ t: 'link', href: m[2], c: parseInline(m[1]) })
      else out.push({ t: 'text', v: m[1] })
      i += m[0].length
      continue
    }
    if ((m = rest.match(/^\[(\d{1,3})\]/))) { flush(); out.push({ t: 'cite', n: Number(m[1]) }); i += m[0].length; continue }
    text += src[i]
    i++
  }
  flush()
  return out
}

/** Block markdown → nodes. */
export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  const endPara = () => { if (para.length) { blocks.push({ t: 'p', c: parseInline(para.join('\n')) }); para = [] } }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = line.match(/^\s*```/)
    if (fence) {
      endPara()
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
      blocks.push({ t: 'pre', v: body.join('\n') })
      continue
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) { endPara(); blocks.push({ t: 'h', level: h[1].length, c: parseInline(h[2]) }); continue }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/)
    const ol = line.match(/^\s*(\d{1,4})[.)]\s+(.*)$/)
    if (ul || ol) {
      endPara()
      const kind = ul ? 'ul' : 'ol'
      const last = blocks.at(-1)
      const item = parseInline((ul ? ul[1] : ol![2]).trim())
      if (last && last.t === kind) last.items.push(item)
      else blocks.push(kind === 'ul' ? { t: 'ul', items: [item] } : { t: 'ol', items: [item], start: Number(ol![1]) })
      continue
    }
    if (!line.trim()) { endPara(); continue }
    para.push(line)
  }
  endPara()
  return blocks
}
