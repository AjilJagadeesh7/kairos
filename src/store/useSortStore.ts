import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SortDir, SortField, SortPref, SortScope } from '../types'

/**
 * Defaults reproduce how each list was ordered before sorting was configurable,
 * so an existing vault looks unchanged until the user picks something else.
 */
const DEFAULTS: Record<SortScope, SortPref> = {
  notes:       { field: 'updated', dir: 'desc' },
  canvas:      { field: 'updated', dir: 'desc' },
  pennotes:    { field: 'updated', dir: 'desc' },
  attachments: { field: 'title',   dir: 'asc'  },
}

type SortState = {
  /** Partial on purpose: a scope added in a later version falls back to its default. */
  prefs: Partial<Record<SortScope, SortPref>>
  setField: (scope: SortScope, field: SortField) => void
  setDir: (scope: SortScope, dir: SortDir) => void
  reset: (scope: SortScope) => void
}

export const useSortStore = create<SortState>()(
  persist(
    (set, get) => ({
      prefs: {},

      setField: (scope, field) => set(s => ({
        prefs: { ...s.prefs, [scope]: { ...getPref(get().prefs, scope), field } },
      })),

      setDir: (scope, dir) => set(s => ({
        prefs: { ...s.prefs, [scope]: { ...getPref(get().prefs, scope), dir } },
      })),

      reset: (scope) => set(s => {
        const next = { ...s.prefs }
        delete next[scope]
        return { prefs: next }
      }),
    }),
    { name: 'kairos-sort' },
  ),
)

function getPref(prefs: Partial<Record<SortScope, SortPref>>, scope: SortScope): SortPref {
  return prefs[scope] ?? DEFAULTS[scope]
}

/** The active preference for a scope, falling back to its default. */
export function useSortPref(scope: SortScope): SortPref {
  return useSortStore(s => s.prefs[scope] ?? DEFAULTS[scope])
}

/** Non-reactive read, for use outside React. */
export function getSortPref(scope: SortScope): SortPref {
  return getPref(useSortStore.getState().prefs, scope)
}

export function isDefaultSort(pref: SortPref, scope: SortScope): boolean {
  return pref.field === DEFAULTS[scope].field && pref.dir === DEFAULTS[scope].dir
}
