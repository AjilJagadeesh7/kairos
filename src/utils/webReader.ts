/**
 * Reader-mode extraction for canvas web nodes.
 *
 * Sites that refuse to be iframed (Google, banks, most login pages) still serve
 * ordinary HTML, so we fetch it through the proxy and render the article
 * ourselves. Nothing is framed, so `X-Frame-Options` and frame-busting simply
 * don't apply.
 *
 * SECURITY: this never produces an HTML string for `dangerouslySetInnerHTML`.
 * It walks the parsed document and emits a small, serialisable block model made
 * only of text and known-safe fields. Rebuilding from an allowlist means a
 * malicious page cannot inject markup, scripts or event handlers — there is no
 * path from fetched bytes to executable HTML.
 */

export interface ReaderSpan {
  text: string
  href?: string
  strong?: boolean
  em?: boolean
  code?: boolean
}

export type ReaderBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; spans: ReaderSpan[] }
  | { kind: 'list'; ordered: boolean; items: ReaderSpan[][] }
  | { kind: 'quote'; spans: ReaderSpan[] }
  | { kind: 'code'; text: string }
  | { kind: 'image'; src: string; alt: string }

export interface PageMeta {
  title: string
  description?: string
  image?: string
  siteName?: string
  favicon?: string
}

export interface ParsedPage {
  meta: PageMeta
  blocks: ReaderBlock[]
}

/** Chrome that never belongs in the article body. */
const STRIP = 'script,style,noscript,iframe,svg,form,nav,aside,header,footer,button,input,select,textarea,video,audio,template'

/** Containers worth considering as the article root, best first. */
const CANDIDATES = ['article', '[role="main"]', 'main', '#content', '.post', '.article', '.content']

/** Only http(s) survives — blocks javascript:, data: and friends. */
function safeUrl(raw: string | null | undefined, base: string): string | undefined {
  if (!raw) return undefined
  try {
    const u = new URL(raw, base)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined
  } catch {
    return undefined
  }
}

function metaContent(doc: Document, names: string[]): string | undefined {
  for (const name of names) {
    const el = doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)
    const content = el?.getAttribute('content')?.trim()
    if (content) return content
  }
  return undefined
}

export function extractMeta(doc: Document, baseUrl: string): PageMeta {
  const title =
    metaContent(doc, ['og:title', 'twitter:title'])
    ?? doc.querySelector('title')?.textContent?.trim()
    ?? new URL(baseUrl).hostname

  const iconHref = doc.querySelector('link[rel~="icon"]')?.getAttribute('href')

  return {
    title,
    description: metaContent(doc, ['og:description', 'twitter:description', 'description']),
    image: safeUrl(metaContent(doc, ['og:image', 'twitter:image']), baseUrl),
    siteName: metaContent(doc, ['og:site_name']),
    favicon: safeUrl(iconHref, baseUrl) ?? safeUrl('/favicon.ico', baseUrl),
  }
}

/** Total length of text sitting in <p> descendants — a decent article signal. */
function paragraphScore(el: Element): number {
  let score = 0
  for (const p of el.querySelectorAll('p')) score += (p.textContent ?? '').trim().length
  return score
}

/** Pick the subtree most likely to be the article body. */
function findArticleRoot(doc: Document): Element | null {
  for (const selector of CANDIDATES) {
    const el = doc.querySelector(selector)
    if (el && paragraphScore(el) > 200) return el
  }
  // Fall back to whichever block-level container holds the most prose.
  let best: Element | null = null
  let bestScore = 200
  for (const el of doc.querySelectorAll('div,section')) {
    const score = paragraphScore(el)
    if (score > bestScore) { best = el; bestScore = score }
  }
  return best ?? doc.body
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Flatten an element's children into styled spans, keeping links. */
function toSpans(el: Element, base: string): ReaderSpan[] {
  const spans: ReaderSpan[] = []

  function walk(node: Node, fmt: Omit<ReaderSpan, 'text'>) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (text.trim()) spans.push({ ...fmt, text })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const child = node as Element
    const tag = child.tagName.toLowerCase()
    const next: Omit<ReaderSpan, 'text'> = { ...fmt }
    if (tag === 'strong' || tag === 'b') next.strong = true
    if (tag === 'em' || tag === 'i') next.em = true
    if (tag === 'code') next.code = true
    if (tag === 'a') {
      const href = safeUrl(child.getAttribute('href'), base)
      if (href) next.href = href
    }
    for (const grandchild of Array.from(child.childNodes)) walk(grandchild, next)
  }

  for (const node of Array.from(el.childNodes)) walk(node, {})

  // Merge neighbours with identical formatting so the output isn't fragmented.
  const merged: ReaderSpan[] = []
  for (const span of spans) {
    const prev = merged[merged.length - 1]
    if (prev && prev.href === span.href && prev.strong === span.strong
      && prev.em === span.em && prev.code === span.code) {
      prev.text += span.text
    } else {
      merged.push({ ...span })
    }
  }
  return merged.map(s => ({ ...s, text: collapse(s.text) })).filter(s => s.text.length > 0)
}

/** Walk the article root and emit the block model. */
function toBlocks(root: Element, base: string, limit: number): ReaderBlock[] {
  const blocks: ReaderBlock[] = []

  for (const el of Array.from(root.querySelectorAll('h1,h2,h3,h4,p,ul,ol,blockquote,pre,img'))) {
    if (blocks.length >= limit) break
    // Skip anything nested inside a block we've already captured whole.
    if (el.closest('blockquote') && el.tagName.toLowerCase() !== 'blockquote') continue
    if (el.closest('li')) continue

    const tag = el.tagName.toLowerCase()

    if (tag === 'img') {
      const src = safeUrl(el.getAttribute('src') ?? el.getAttribute('data-src'), base)
      if (src) blocks.push({ kind: 'image', src, alt: collapse(el.getAttribute('alt') ?? '') })
      continue
    }

    if (tag === 'pre') {
      const text = (el.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
      if (text) blocks.push({ kind: 'code', text })
      continue
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.children)
        .filter(li => li.tagName.toLowerCase() === 'li')
        .map(li => toSpans(li, base))
        .filter(spans => spans.length > 0)
      if (items.length > 0) blocks.push({ kind: 'list', ordered: tag === 'ol', items })
      continue
    }

    if (tag === 'blockquote') {
      const spans = toSpans(el, base)
      if (spans.length > 0) blocks.push({ kind: 'quote', spans })
      continue
    }

    if (tag === 'p') {
      const spans = toSpans(el, base)
      if (spans.length > 0) blocks.push({ kind: 'paragraph', spans })
      continue
    }

    // h1–h4, flattened to three visual levels
    const text = collapse(el.textContent ?? '')
    if (text) {
      const level = tag === 'h1' ? 1 : tag === 'h2' ? 2 : 3
      blocks.push({ kind: 'heading', level, text })
    }
  }

  return blocks
}

/**
 * Parse fetched HTML into page metadata plus a readable block model.
 * `blocks` is empty when the page has no extractable prose — the caller should
 * fall back to a link card in that case.
 */
export function parseWebPage(html: string, baseUrl: string, blockLimit = 300): ParsedPage {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const meta = extractMeta(doc, baseUrl)

  // Remove chrome before scoring so nav-heavy pages don't win on markup volume.
  for (const el of Array.from(doc.querySelectorAll(STRIP))) el.remove()

  const root = findArticleRoot(doc)
  const blocks = root ? toBlocks(root, baseUrl, blockLimit) : []

  return { meta, blocks }
}
