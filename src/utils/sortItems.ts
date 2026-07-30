import type { SortDir, SortField, SortPref } from '../types'

/** Anything datable enough to sort: every content type carries both stamps. */
export interface SortableItem {
  createdAt: string
  updatedAt: string
}

export const SORT_FIELD_LABEL: Record<SortField, string> = {
  title:   'Name',
  updated: 'Last updated',
  created: 'Date created',
}

/** Direction wording flips meaning between text and dates, so label it per field. */
export function dirLabel(field: SortField, dir: SortDir): string {
  if (field === 'title') return dir === 'asc' ? 'A → Z' : 'Z → A'
  return dir === 'asc' ? 'Oldest first' : 'Newest first'
}

// Numeric so "Note 2" sorts before "Note 10"; base sensitivity so case and
// accents don't split otherwise-identical names.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * Comparator for a sort preference. `label` supplies the text key, since the
 * field is `title` on most types but `name` on attachments.
 */
export function compareBy<T extends SortableItem>(
  pref: SortPref,
  label: (item: T) => string,
): (a: T, b: T) => number {
  const flip = pref.dir === 'asc' ? 1 : -1

  return (a, b) => {
    if (pref.field === 'title') return collator.compare(label(a), label(b)) * flip

    const key = pref.field === 'created' ? 'createdAt' : 'updatedAt'
    const at = Date.parse(a[key]) || 0
    const bt = Date.parse(b[key]) || 0
    // Identical stamps are common after an import or a folder pull — fall back to
    // the name so the order stays stable instead of shuffling between renders.
    if (at === bt) return collator.compare(label(a), label(b))
    return (at - bt) * flip
  }
}

/** Sorted copy — never mutates the store array it was handed. */
export function sortItems<T extends SortableItem>(
  items: T[],
  pref: SortPref,
  label: (item: T) => string,
): T[] {
  return [...items].sort(compareBy(pref, label))
}

/**
 * Direction for name-only lists such as folders, which have no timestamps to
 * sort by: they follow the chosen direction when sorting by name, and stay A→Z
 * under the date fields, where reversing them would mean nothing.
 */
export function nameOrder(pref: SortPref): 1 | -1 {
  return pref.field === 'title' && pref.dir === 'desc' ? -1 : 1
}

/** Sorted copy of a plain name list (folders). */
export function sortNames(names: string[], pref: SortPref): string[] {
  const flip = nameOrder(pref)
  return [...names].sort((a, b) => collator.compare(a, b) * flip)
}
