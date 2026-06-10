// Text-quote anchoring for reading-mode annotations. Maps between a plain-text
// selection (quote + surrounding context) and a live DOM Range inside a
// container, so highlights can be re-painted after re-render and survive edits
// elsewhere in the document.

const CONTEXT_LEN = 32

export interface QuoteSelector {
  quote: string
  prefix: string
  suffix: string
}

/** Walk text nodes in document order. */
function walkText(container: Node): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let n = walker.nextNode()
  while (n) { nodes.push(n as Text); n = walker.nextNode() }
  return nodes
}

/** Absolute text offset of (node, offset) within container's concatenated text. */
function offsetWithin(container: Node, node: Node, nodeOffset: number): number | null {
  let acc = 0
  for (const t of walkText(container)) {
    if (t === node) return acc + nodeOffset
    acc += t.data.length
  }
  // Selection endpoint may sit on an element node (e.g. between blocks); fall
  // back to summing text up to that element.
  if (node.nodeType === Node.ELEMENT_NODE) {
    let acc2 = 0
    for (const t of walkText(container)) {
      if (node.contains(t)) return acc2
      acc2 += t.data.length
    }
  }
  return null
}

/** Convert a plain-text [start,end) offset range into a live DOM Range. */
export function offsetsToRange(container: Node, start: number, end: number): Range | null {
  let acc = 0
  let startNode: Text | null = null, startOff = 0
  let endNode: Text | null = null, endOff = 0
  for (const t of walkText(container)) {
    const len = t.data.length
    if (!startNode && start <= acc + len) { startNode = t; startOff = start - acc }
    if (start < acc + len + 1 && end <= acc + len) { endNode = t; endOff = end - acc; break }
    acc += len
  }
  if (!startNode || !endNode) return null
  try {
    const range = document.createRange()
    range.setStart(startNode, Math.max(0, Math.min(startOff, startNode.data.length)))
    range.setEnd(endNode, Math.max(0, Math.min(endOff, endNode.data.length)))
    return range
  } catch {
    return null
  }
}

/** Build a QuoteSelector from the current window selection inside `container`. */
export function getSelectionQuote(container: HTMLElement): (QuoteSelector & { range: Range }) | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer)) return null

  const quote = sel.toString()
  if (!quote.trim()) return null

  const start = offsetWithin(container, range.startContainer, range.startOffset)
  const end = offsetWithin(container, range.endContainer, range.endOffset)
  if (start == null || end == null) return null

  const full = container.textContent ?? ''
  const lo = Math.min(start, end)
  const hi = Math.max(start, end)
  return {
    quote,
    prefix: full.slice(Math.max(0, lo - CONTEXT_LEN), lo),
    suffix: full.slice(hi, hi + CONTEXT_LEN),
    range,
  }
}

/** Find the DOM Range for a stored selector, disambiguating by prefix/suffix. */
export function resolveQuote(container: HTMLElement, sel: QuoteSelector): Range | null {
  const full = container.textContent ?? ''
  if (!sel.quote) return null

  // Collect all occurrences of the quote.
  const candidates: number[] = []
  let i = full.indexOf(sel.quote)
  while (i !== -1) { candidates.push(i); i = full.indexOf(sel.quote, i + 1) }
  if (candidates.length === 0) return null

  // Score each by how much of prefix/suffix matches; pick the best.
  let best = candidates[0]
  let bestScore = -1
  for (const c of candidates) {
    const before = full.slice(Math.max(0, c - sel.prefix.length), c)
    const after = full.slice(c + sel.quote.length, c + sel.quote.length + sel.suffix.length)
    let score = 0
    if (sel.prefix && before.endsWith(sel.prefix)) score += 2
    else if (sel.prefix && before.slice(-4) === sel.prefix.slice(-4)) score += 1
    if (sel.suffix && after.startsWith(sel.suffix)) score += 2
    else if (sel.suffix && after.slice(0, 4) === sel.suffix.slice(0, 4)) score += 1
    if (score > bestScore) { bestScore = score; best = c }
  }

  return offsetsToRange(container, best, best + sel.quote.length)
}
