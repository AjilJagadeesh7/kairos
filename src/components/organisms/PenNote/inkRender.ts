import { getStroke } from 'perfect-freehand'
import { AUTO_INK } from '../../../types'
import type { PenStroke } from '../../../types'

interface StrokeOptions {
  size: number
  thinning: number
  smoothing: number
  streamline: number
  simulatePressure: boolean
}

function options(stroke: PenStroke): StrokeOptions {
  if (stroke.tool === 'highlighter') {
    // Highlighter: uniform thick band, no pressure tapering.
    return { size: stroke.size, thinning: 0, smoothing: 0.4, streamline: 0.4, simulatePressure: false }
  }
  return { size: stroke.size * 2.2, thinning: 0.6, smoothing: 0.5, streamline: 0.5, simulatePressure: false }
}

/** perfect-freehand outline polygon for a stroke (content coords). */
export function strokeOutline(stroke: PenStroke): number[][] {
  return getStroke(stroke.points, options(stroke)) as number[][]
}

/** Build a smooth, closed Path2D from a perfect-freehand outline. */
export function outlineToPath2D(outline: number[][]): Path2D {
  const path = new Path2D()
  if (outline.length < 2) return path
  const [first] = outline
  path.moveTo(first[0], first[1])
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1]
    const [x1, y1] = outline[i]
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
  }
  path.closePath()
  return path
}

/**
 * Draw a single stroke onto the 2D context (content-space coordinates).
 * `autoColor` resolves the theme-following AUTO_INK sentinel (the theme text
 * color), so default ink is visible on both light and dark backgrounds.
 */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: PenStroke, autoColor = '#111827'): void {
  const outline = strokeOutline(stroke)
  if (outline.length < 2) return
  const path = outlineToPath2D(outline)

  ctx.save()
  if (stroke.tool === 'highlighter') {
    ctx.globalAlpha = 0.35
    ctx.globalCompositeOperation = 'multiply'
  }
  ctx.fillStyle = stroke.color === AUTO_INK ? autoColor : stroke.color
  ctx.fill(path)
  ctx.restore()
}

/** Axis-aligned bounding box of a stroke's input points. */
export function strokeBBox(stroke: PenStroke): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of stroke.points) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  const pad = stroke.size
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
}
