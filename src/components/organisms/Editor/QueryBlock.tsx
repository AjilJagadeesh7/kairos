import { useMemo } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { parseQuery } from '../../../utils/queryParser'
import { executeQuery } from '../../../utils/queryEngine'

interface QueryBlockProps {
  query: string
}

function navigateToNote(id: string) {
  window.dispatchEvent(new CustomEvent('mv:navigate', { detail: { path: '/notes/' + id } }))
}

// ── List view ─────────────────────────────────────────────────────────────────

function ListView({ results }: { results: ReturnType<typeof executeQuery>['results'] }) {
  return (
    <ul className="space-y-0.5">
      {results.map(r => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => navigateToNote(r.id)}
            className="w-full text-left px-2 py-1 rounded text-sm hover:bg-[rgb(var(--surface-2))] transition-colors"
            style={{ color: 'rgb(var(--accent))' }}
          >
            {r.title}
          </button>
        </li>
      ))}
    </ul>
  )
}

// ── Table view ────────────────────────────────────────────────────────────────

function TableView({
  results,
  columns,
}: {
  results: ReturnType<typeof executeQuery>['results']
  columns: string[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ borderBottom: '1px solid rgb(var(--border))' }}>
            {columns.map(col => (
              <th
                key={col}
                className="px-2 py-1.5 text-left font-medium uppercase tracking-wider"
                style={{ color: 'rgb(var(--text-3))' }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map(r => (
            <tr
              key={r.id}
              onClick={() => navigateToNote(r.id)}
              className="cursor-pointer transition-colors hover:bg-[rgb(var(--surface-2))]"
              style={{ borderBottom: '1px solid rgb(var(--border))' }}
            >
              {columns.map(col => (
                <td key={col} className="px-2 py-1.5">
                  {col === 'title' ? (
                    <span style={{ color: 'rgb(var(--accent))' }}>{r.fields[col] ?? r.title}</span>
                  ) : (
                    <span style={{ color: 'rgb(var(--text-2))' }}>{r.fields[col] ?? ''}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── QueryBlock ────────────────────────────────────────────────────────────────

export function QueryBlock({ query }: QueryBlockProps) {
  const notes = useAppStore(s => s.notes)

  const { ast, output, error } = useMemo(() => {
    try {
      const ast = parseQuery(query)
      const output = executeQuery(ast, notes)
      return { ast, output, error: null }
    } catch (e) {
      return { ast: null, output: null, error: String(e) }
    }
  }, [query, notes])

  return (
    <div
      className="my-3 rounded-lg overflow-hidden text-sm"
      style={{
        border: '1px solid rgb(var(--border))',
        background: 'rgb(var(--surface))',
      }}
      contentEditable={false}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-xs font-medium"
        style={{
          borderBottom: '1px solid rgb(var(--border))',
          background: 'rgb(var(--surface-2))',
          color: 'rgb(var(--text-3))',
        }}
      >
        <span className="uppercase tracking-wider">Query</span>
        {output && (
          <span>{output.results.length} result{output.results.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Body */}
      <div className="p-2">
        {error && (
          <div
            className="px-3 py-2 rounded text-xs"
            style={{ color: 'rgb(var(--text-3))', background: 'rgb(var(--surface-2))' }}
          >
            Query error: {error}
          </div>
        )}

        {output && output.results.length === 0 && (
          <div
            className="px-3 py-4 text-center text-xs"
            style={{ color: 'rgb(var(--text-3))' }}
          >
            No results found
          </div>
        )}

        {output && output.results.length > 0 && ast?.view === 'list' && (
          <ListView results={output.results} />
        )}

        {output && output.results.length > 0 && ast?.view !== 'list' && (
          <TableView results={output.results} columns={output.columns} />
        )}
      </div>
    </div>
  )
}
