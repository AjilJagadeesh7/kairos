// ── Types ──────────────────────────────────────────────────────────────────────

export type ViewMode = 'table' | 'list'

export type FilterOp = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains'

export type SortDir = 'ASC' | 'DESC'

export interface Source {
  kind: 'tag' | 'folder'
  value: string
}

export interface Filter {
  field: string
  op: FilterOp
  value: string
}

export interface SortClause {
  field: string
  dir: SortDir
}

export interface QueryAST {
  view: ViewMode
  source: Source | null
  filters: Filter[]
  sort: SortClause | null
  limit: number | null
  show: string[] | null
}

// ── Parser ────────────────────────────────────────────────────────────────────

const OP_RE = />=|<=|!=|>|<|=/

function parseSource(value: string): Source {
  const trimmed = value.trim()
  if (trimmed.startsWith('#')) {
    return { kind: 'tag', value: trimmed.slice(1) }
  }
  // "folder/path" → strip surrounding quotes
  return { kind: 'folder', value: trimmed.replace(/^["']|["']$/g, '') }
}

function parseFilter(expr: string): Filter | null {
  const m = expr.match(new RegExp(`^(\\w+)\\s*(${OP_RE.source}|contains)\\s*["']?([^"']*)["']?\\s*$`, 'i'))
  if (!m) return null
  const field = m[1].toLowerCase()
  const opRaw = m[2].toLowerCase()
  const value = m[3].trim()

  const opMap: Record<string, FilterOp> = {
    '=': '=', '!=': '!=', '>': '>', '<': '<', '>=': '>=', '<=': '<=', 'contains': 'contains',
  }
  const op = opMap[opRaw]
  if (!op) return null
  return { field, op, value }
}

/**
 * Parse a dataview-style query string into a QueryAST.
 *
 * Supported clauses (one per line, case-insensitive keyword):
 *   VIEW table|list
 *   FROM #tag | "folder/path"
 *   WHERE field op "value"  (op: =, !=, >, <, >=, <=, contains)
 *   SORT field ASC|DESC
 *   LIMIT n
 *   SHOW col1, col2, ...
 */
export function parseQuery(raw: string): QueryAST {
  const ast: QueryAST = {
    view: 'table',
    source: null,
    filters: [],
    sort: null,
    limit: null,
    show: null,
  }

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    const upper = line.toUpperCase()

    if (upper.startsWith('VIEW ')) {
      const mode = line.slice(5).trim().toLowerCase()
      if (mode === 'list' || mode === 'table') ast.view = mode
    } else if (upper.startsWith('FROM ')) {
      ast.source = parseSource(line.slice(5))
    } else if (upper.startsWith('WHERE ')) {
      const filter = parseFilter(line.slice(6))
      if (filter) ast.filters.push(filter)
    } else if (upper.startsWith('SORT ')) {
      const parts = line.slice(5).trim().split(/\s+/)
      const field = parts[0].toLowerCase()
      const dir: SortDir = parts[1]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
      ast.sort = { field, dir }
    } else if (upper.startsWith('LIMIT ')) {
      const n = parseInt(line.slice(6).trim(), 10)
      if (!isNaN(n) && n > 0) ast.limit = n
    } else if (upper.startsWith('SHOW ')) {
      ast.show = line.slice(5).split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    }
  }

  return ast
}
