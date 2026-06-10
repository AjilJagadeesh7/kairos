// Captured handwriting ink, used by the native handwriting→text recognizers
// (src/adapters/handwriting). Pen notes themselves use the richer PenStroke
// model in penNote.types.ts; this lighter shape is the recognizer input.

/** A single sampled point along a stroke. */
export interface StrokePoint {
  x: number
  y: number
  /** Pressure 0..1 when the device reports it; absent for mouse/finger. */
  p?: number
  /** Timestamp (ms, performance.now) — used by handwriting recognizers. */
  t?: number
}

/** One continuous pen-down → pen-up stroke. */
export interface Stroke {
  points: StrokePoint[]
  color: string
  /** Nominal stroke width (pressure modulates the rendered width). */
  width: number
}
