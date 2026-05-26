import { useCallback, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { FrontmatterField, FrontmatterFieldType } from '../types'

const NOTE_LINK_RE = /^\[\[.+\]\]$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/

function inferType(value: unknown): FrontmatterFieldType {
  if (typeof value === 'boolean') return 'checkbox'
  if (typeof value === 'number') return 'number'
  if (Array.isArray(value)) return 'list'
  if (typeof value === 'string') {
    if (NOTE_LINK_RE.test(value)) return 'note-link'
    if (ISO_DATE_RE.test(value)) return 'date'
  }
  return 'text'
}

function normalizeValue(value: unknown): FrontmatterField['value'] {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value
  if (Array.isArray(value)) return value.map(String)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value ?? '')
}

function defaultValueForType(type: FrontmatterFieldType): FrontmatterField['value'] {
  switch (type) {
    case 'checkbox': return false
    case 'number':   return 0
    case 'list':     return []
    case 'date':     return new Date().toISOString().slice(0, 10)
    default:         return ''
  }
}

export function useFrontmatter(noteId: string, userFrontmatter: Record<string, unknown> | undefined) {
  const updateNoteFrontmatter = useAppStore(s => s.updateNoteFrontmatter)

  const fields: FrontmatterField[] = useMemo(() => {
    if (!userFrontmatter) return []
    return Object.entries(userFrontmatter).map(([key, raw]) => ({
      key,
      value: normalizeValue(raw),
      type: inferType(raw),
    }))
  }, [userFrontmatter])

  const setField = useCallback((key: string, value: FrontmatterField['value']) => {
    const next = { ...(userFrontmatter ?? {}), [key]: value }
    void updateNoteFrontmatter(noteId, next)
  }, [noteId, userFrontmatter, updateNoteFrontmatter])

  const removeField = useCallback((key: string) => {
    const next = { ...(userFrontmatter ?? {}) }
    delete next[key]
    void updateNoteFrontmatter(noteId, next)
  }, [noteId, userFrontmatter, updateNoteFrontmatter])

  const renameField = useCallback((oldKey: string, newKey: string) => {
    if (!newKey || oldKey === newKey) return
    const current = userFrontmatter ?? {}
    const next: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(current)) {
      next[k === oldKey ? newKey : k] = v
    }
    void updateNoteFrontmatter(noteId, next)
  }, [noteId, userFrontmatter, updateNoteFrontmatter])

  const addField = useCallback((key: string, type: FrontmatterFieldType) => {
    if (!key) return
    const next = { ...(userFrontmatter ?? {}), [key]: defaultValueForType(type) }
    void updateNoteFrontmatter(noteId, next)
  }, [noteId, userFrontmatter, updateNoteFrontmatter])

  const setRaw = useCallback((raw: Record<string, unknown>) => {
    void updateNoteFrontmatter(noteId, raw)
  }, [noteId, updateNoteFrontmatter])

  return { fields, setField, removeField, renameField, addField, setRaw }
}
