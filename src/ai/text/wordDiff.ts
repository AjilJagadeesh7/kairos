/** Word-level diff for rewrite previews (removed text struck, added highlighted). */

export interface DiffOp {
  type: 'same' | 'del' | 'ins'
  text: string
}

/** Above this many LCS cells the diff degrades to "replace everything". */
const MAX_CELLS = 4_000_000

function tokenize(text: string): string[] {
  return text.match(/\s+|[\p{L}\p{N}_'’-]+|[^\s\p{L}\p{N}]/gu) ?? []
}

function push(ops: DiffOp[], type: DiffOp['type'], text: string) {
  if (!text) return
  const last = ops[ops.length - 1]
  if (last && last.type === type) last.text += text
  else ops.push({ type, text })
}

export function wordDiff(before: string, after: string): DiffOp[] {
  const a = tokenize(before)
  const b = tokenize(after)

  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB-- }

  const ops: DiffOp[] = []
  push(ops, 'same', a.slice(0, start).join(''))

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const n = midA.length
  const m = midB.length

  if (n * m > MAX_CELLS) {
    push(ops, 'del', midA.join(''))
    push(ops, 'ins', midB.join(''))
  } else {
    // lcs[i][j] = LCS length of midA[i..] and midB[j..], stored row-major.
    const lcs = new Uint32Array((n + 1) * (m + 1))
    const w = m + 1
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i * w + j] = midA[i] === midB[j]
          ? lcs[(i + 1) * w + j + 1] + 1
          : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (midA[i] === midB[j]) { push(ops, 'same', midA[i]); i++; j++ }
      else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) { push(ops, 'del', midA[i]); i++ }
      else { push(ops, 'ins', midB[j]); j++ }
    }
    push(ops, 'del', midA.slice(i).join(''))
    push(ops, 'ins', midB.slice(j).join(''))
  }

  push(ops, 'same', a.slice(endA).join(''))
  return ops
}
