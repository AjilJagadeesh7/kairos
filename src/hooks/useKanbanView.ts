import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { KanbanView } from '../types/kanban.types'

const VALID: KanbanView[] = ['board', 'list', 'timeline', 'backlog', 'summary']

/** Reads/writes the active Kanban view from the `?view=` query param. */
export function useKanbanView(): [KanbanView, (view: KanbanView) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('view') as KanbanView | null
  const view: KanbanView = raw && VALID.includes(raw) ? raw : 'board'

  const setView = useCallback((next: KanbanView) => {
    setParams(prev => {
      const p = new URLSearchParams(prev)
      if (next === 'board') p.delete('view')
      else p.set('view', next)
      return p
    }, { replace: true })
  }, [setParams])

  return [view, setView]
}
