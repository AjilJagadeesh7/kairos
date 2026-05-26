import type { Note } from '../types'
import type { QueryAST, FilterOp } from './queryParser'

// ── Result types ───────────────────────────────────────────────────────────────

export interface QueryResult {
  id: string
  title: string
  fields: Record<string, string>
}

export interface QueryOutput {
  results: QueryResult[]
  columns: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve a field name to its string value on a note. */
function resolveField(note: Note, field: string): string {
  switch (field) {
    case 'title':   return note.title
    case 'tags':    return note.tags.join(', ')
    case 'created': return note.createdAt
    case 'updated': return note.updatedAt
    case 'folder':  return note.folder ?? ''
    default:        return String(note.userFrontmatter?.[field] ?? '')
  }
}

function compare(a: string, b: string, op: FilterOp, value: string): boolean {
  const av = a.toLowerCase()
  const bv = value.toLowerCase()

  switch (op) {
    case '=':        return av === bv
    case '!=':       return av !== bv
    case 'contains': return av.includes(bv)
    case '>':        return av > bv
    case '<':        return av < bv
    case '>=':       return av >= bv
    case '<=':       return av <= bv
  }
}

// ── Engine ────────────────────────────────────────────────────────────────────

/**
 * Execute a QueryAST against an array of notes.
 * Returns { results, columns } where columns is suitable for table headers.
 */
export function executeQuery(ast: QueryAST, notes: Note[]): QueryOutput {
  let pool = [...notes]

  // ── FROM filter ─────────────────────────────────────────────────────────────
  if (ast.source) {
    const { kind, value } = ast.source
    if (kind === 'tag') {
      pool = pool.filter(n => n.tags.includes(value))
    } else {
      // folder prefix match
      pool = pool.filter(n => {
        const folder = n.folder ?? ''
        return folder === value || folder.startsWith(value + '/')
      })
    }
  }

  // ── WHERE filters ────────────────────────────────────────────────────────────
  for (const filter of ast.filters) {
    pool = pool.filter(n => {
      const fieldValue = resolveField(n, filter.field)
      return compare(fieldValue, '', filter.op, filter.value)
    })
  }

  // ── SORT ─────────────────────────────────────────────────────────────────────
  if (ast.sort) {
    const { field, dir } = ast.sort
    pool.sort((a, b) => {
      const av = resolveField(a, field)
      const bv = resolveField(b, field)
      const cmp = av.localeCompare(bv)
      return dir === 'DESC' ? -cmp : cmp
    })
  }

  // ── LIMIT ─────────────────────────────────────────────────────────────────────
  if (ast.limit !== null) {
    pool = pool.slice(0, ast.limit)
  }

  // ── Build results ────────────────────────────────────────────────────────────
  const BUILTIN_FIELDS = new Set(['title', 'tags', 'created', 'updated', 'folder'])

  // Derive columns: use ast.show if provided, else derive from frontmatter keys
  let columns: string[]
  if (ast.show && ast.show.length > 0) {
    columns = ast.show
  } else {
    const keySet = new Set<string>(['title'])
    for (const note of pool) {
      if (note.userFrontmatter) {
        for (const key of Object.keys(note.userFrontmatter)) {
          keySet.add(key.toLowerCase())
        }
      }
      // Always surface tags if any note has them
      if (note.tags.length > 0) keySet.add('tags')
    }
    // title first, then sort others
    const rest = [...keySet].filter(k => k !== 'title').sort()
    columns = ['title', ...rest]
  }

  const results: QueryResult[] = pool.map(note => {
    const fields: Record<string, string> = {}
    for (const col of columns) {
      if (BUILTIN_FIELDS.has(col)) {
        fields[col] = resolveField(note, col)
      } else {
        fields[col] = String(note.userFrontmatter?.[col] ?? '')
      }
    }
    return { id: note.id, title: note.title, fields }
  })

  return { results, columns }
}
