// List ordering for the sidebars and the matching home pages. The two share one
// preference per content type, so a list never reorders just because you looked
// at it from a different screen.

export type SortField = 'title' | 'updated' | 'created'

/** `asc` = A→Z / oldest first. `desc` = Z→A / newest first. */
export type SortDir = 'asc' | 'desc'

export interface SortPref {
  field: SortField
  dir: SortDir
}

export type SortScope = 'notes' | 'canvas' | 'attachments' | 'pennotes'
