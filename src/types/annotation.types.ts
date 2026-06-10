// Reading-mode annotations: highlights and sticky notes anchored to a span of
// text. Stored separately from the note's markdown (the .md stays clean) and
// re-anchored on render via a text-quote selector (quote + surrounding context),
// so they survive small edits elsewhere in the document.

export interface Annotation {
  id: string
  /** Note id, or journal date — whatever identifies the document. */
  docId: string
  /** The exact selected text. */
  quote: string
  /** A few characters immediately before/after the quote, for disambiguation. */
  prefix: string
  suffix: string
  /** Highlight color (CSS color). */
  color: string
  /** Optional sticky-note comment attached to the highlight. */
  comment?: string
  createdAt: string
  updatedAt: string
}

/** Highlight palette offered in the reading-mode selection popover. */
export const ANNOTATION_COLORS = [
  '#ffe066', // yellow
  '#a0e8af', // green
  '#9bd0ff', // blue
  '#ffb3c1', // pink
  '#d8b4fe', // purple
] as const
