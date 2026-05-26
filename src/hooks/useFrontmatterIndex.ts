import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'

/**
 * Returns a memoized map of noteId → userFrontmatter.
 * Re-computes only when the notes array reference changes.
 */
export function useFrontmatterIndex(): Map<string, Record<string, unknown>> {
  const notes = useAppStore(s => s.notes)
  return useMemo(() => {
    const map = new Map<string, Record<string, unknown>>()
    for (const note of notes) {
      map.set(note.id, note.userFrontmatter ?? {})
    }
    return map
  }, [notes])
}
