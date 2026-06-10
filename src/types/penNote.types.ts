// Pen notes: a dedicated full-page handwriting document (Samsung-Notes-like),
// NOT ink overlaid on the markdown editor. Stored as compact vector strokes in
// the vault (vault/pennotes/<id>.json) so they sync and stay small even for
// dense handwriting.

export type PenTool = 'pen' | 'highlighter' | 'eraser' | 'lasso'

/** One ink stroke. Points are [x, y, pressure] tuples in content coordinates. */
export interface PenStroke {
  id: string
  tool: 'pen' | 'highlighter'
  color: string
  /** Base stroke width in content px (pressure modulates the rendered width). */
  size: number
  points: [number, number, number][]
}

export interface PenNote {
  id: string
  title: string
  /** Vault-relative folder path: "Lectures/Physics"; "" or undefined = root. */
  folder?: string
  strokes: PenStroke[]
  /** Fixed page width in content px; the page grows in height as you write. */
  pageWidth: number
  /** Current content height in px (grows downward). */
  height: number
  createdAt: string
  updatedAt: string
  tags: string[]
  /** When true this pen note stays local-only (never pushed to remotes). */
  noSync?: boolean
}

/** A point-in-time snapshot of a pen note's ink, for version history. */
export interface PenNoteVersion {
  savedAt: string
  strokeCount: number
  strokes: PenStroke[]
}

/**
 * Sentinel ink color that follows the theme's text color (visible on light and
 * dark backgrounds alike) — resolved at render time.
 */
export const AUTO_INK = 'auto'

/** Pen/highlighter palette for the canvas toolbar. */
export const PEN_COLORS = [AUTO_INK, '#1e88e5', '#e53935', '#43a047', '#fb8c00', '#8e24aa'] as const
export const HIGHLIGHTER_COLORS = ['#ffe066', '#a0e8af', '#9bd0ff', '#ffb3c1'] as const
export const PEN_SIZES = [1.5, 2.5, 4, 6] as const
export const HIGHLIGHTER_SIZE = 18
