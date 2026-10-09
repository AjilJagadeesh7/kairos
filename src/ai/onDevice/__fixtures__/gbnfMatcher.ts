/**
 * A small GBNF interpreter for tests: parses the grammar syntax llama.cpp
 * accepts (literals, char classes, groups, alternation, ?, *, +, {m,n}) and
 * checks whether a whole string matches `root`. Exhaustive (set of end
 * positions), fine for short test strings.
 */
type Node =
  | { t: 'lit'; s: string }
  | { t: 'cls'; neg: boolean; ranges: Array<[number, number]> }
  | { t: 'ref'; name: string }
  | { t: 'seq'; items: Node[] }
  | { t: 'alt'; alts: Node[] }
  | { t: 'rep'; node: Node; min: number; max: number }

function unescape(src: string, i: number): [string, number] {
  const c = src[i + 1]
  if (c === 'x') return [String.fromCharCode(parseInt(src.slice(i + 2, i + 4), 16)), i + 4]
  if (c === 'u') return [String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16)), i + 6]
  return [{ n: '\n', t: '\t', r: '\r' }[c as 'n'] ?? c, i + 2]
}

export function parseGbnf(text: string): Map<string, Node> {
  const rules = new Map<string, Node>()
  let src = ''
  let i = 0
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++ }
  function alt(): Node {
    const alts = [seq()]
    ws()
    while (src[i] === '|') { i++; alts.push(seq()); ws() }
    return alts.length === 1 ? alts[0] : { t: 'alt', alts }
  }
  function seq(): Node {
    const items: Node[] = []
    for (;;) {
      ws()
      if (i >= src.length || src[i] === '|' || src[i] === ')') break
      items.push(postfix(atom()))
    }
    return { t: 'seq', items }
  }
  function postfix(n: Node): Node {
    const c = src[i]
    if (c === '?') { i++; return { t: 'rep', node: n, min: 0, max: 1 } }
    if (c === '*') { i++; return { t: 'rep', node: n, min: 0, max: Infinity } }
    if (c === '+') { i++; return { t: 'rep', node: n, min: 1, max: Infinity } }
    if (c === '{') {
      const end = src.indexOf('}', i)
      const [a, b] = src.slice(i + 1, end).split(',')
      i = end + 1
      return { t: 'rep', node: n, min: Number(a), max: b === undefined ? Number(a) : b === '' ? Infinity : Number(b) }
    }
    return n
  }
  function atom(): Node {
    const c = src[i]
    if (c === '(') { i++; const n = alt(); ws(); if (src[i] !== ')') throw new Error(`expected ) at ${i}`); i++; return n }
    if (c === '"') {
      let s = ''
      i++
      while (src[i] !== '"') {
        if (src[i] === '\\') { const [ch, j] = unescape(src, i); s += ch; i = j } else s += src[i++]
      }
      i++
      return { t: 'lit', s }
    }
    if (c === '[') {
      i++
      const neg = src[i] === '^'
      if (neg) i++
      const ranges: Array<[number, number]> = []
      const one = (): string => { if (src[i] === '\\') { const [ch, j] = unescape(src, i); i = j; return ch } return src[i++] }
      while (src[i] !== ']') {
        const a = one()
        if (src[i] === '-' && src[i + 1] !== ']') { i++; const b = one(); ranges.push([a.charCodeAt(0), b.charCodeAt(0)]) } else ranges.push([a.charCodeAt(0), a.charCodeAt(0)])
      }
      i++
      return { t: 'cls', neg, ranges }
    }
    const m = src.slice(i).match(/^[a-zA-Z0-9-]+/)
    if (!m) throw new Error(`unexpected "${src.slice(i, i + 10)}"`)
    i += m[0].length
    return { t: 'ref', name: m[0] }
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9-]+) ::= (.*)$/)
    if (!m) throw new Error(`bad rule line: ${line}`)
    src = m[2]
    i = 0
    rules.set(m[1], alt())
    ws()
    if (i !== src.length) throw new Error(`trailing input in ${m[1]}: ${src.slice(i)}`)
  }
  for (const [name, node] of rules) {
    const check = (n: Node): void => {
      if (n.t === 'ref' && !rules.has(n.name)) throw new Error(`undefined rule ${n.name} (in ${name})`)
      if (n.t === 'seq') n.items.forEach(check)
      if (n.t === 'alt') n.alts.forEach(check)
      if (n.t === 'rep') check(n.node)
    }
    check(node)
  }
  return rules
}

export function gbnfMatches(grammar: string, input: string): boolean {
  const rules = parseGbnf(grammar)
  const memo = new Map<string, Set<number>>()
  function ends(n: Node, pos: number): Set<number> {
    switch (n.t) {
      case 'lit': return new Set(input.startsWith(n.s, pos) ? [pos + n.s.length] : [])
      case 'cls': {
        if (pos >= input.length) return new Set()
        const code = input.charCodeAt(pos)
        const hit = n.ranges.some(([a, b]) => code >= a && code <= b)
        return new Set(hit !== n.neg ? [pos + 1] : [])
      }
      case 'ref': {
        const key = `${n.name}@${pos}`
        const cached = memo.get(key)
        if (cached) return cached
        memo.set(key, new Set())
        const out = ends(rules.get(n.name)!, pos)
        memo.set(key, out)
        return out
      }
      case 'seq': {
        let cur = new Set([pos])
        for (const item of n.items) {
          const next = new Set<number>()
          for (const p of cur) for (const e of ends(item, p)) next.add(e)
          cur = next
          if (!cur.size) break
        }
        return cur
      }
      case 'alt': {
        const out = new Set<number>()
        for (const a of n.alts) for (const e of ends(a, pos)) out.add(e)
        return out
      }
      case 'rep': {
        const out = new Set<number>()
        let frontier = new Set([pos])
        if (n.min === 0) out.add(pos)
        for (let k = 1; k <= Math.min(n.max, input.length + 1) && frontier.size; k++) {
          const next = new Set<number>()
          for (const p of frontier) for (const e of ends(n.node, p)) if (e !== p || k <= n.min) next.add(e)
          frontier = next
          if (k >= n.min) for (const e of frontier) out.add(e)
        }
        return out
      }
    }
  }
  return ends({ t: 'ref', name: 'root' }, 0).has(input.length)
}
