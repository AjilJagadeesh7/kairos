import type { PenStroke } from '../../../types'

/** Standard even-odd ray-casting point-in-polygon test. */
export function pointInPolygon(x: number, y: number, poly: number[][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Squared distance from point (px,py) to segment (ax,ay)-(bx,by). */
function distSqToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx, cy = ay + t * dy
  return (px - cx) ** 2 + (py - cy) ** 2
}

/** True if the eraser circle (ex,ey,radius) touches the stroke's path. */
export function strokeHitByEraser(stroke: PenStroke, ex: number, ey: number, radius: number): boolean {
  const r2 = (radius + stroke.size) ** 2
  const pts = stroke.points
  if (pts.length === 1) {
    return (pts[0][0] - ex) ** 2 + (pts[0][1] - ey) ** 2 <= r2
  }
  for (let i = 1; i < pts.length; i++) {
    if (distSqToSegment(ex, ey, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= r2) return true
  }
  return false
}

/** True if a meaningful part of the stroke lies inside the lasso polygon. */
export function strokeInsideLasso(stroke: PenStroke, lasso: number[][]): boolean {
  if (lasso.length < 3) return false
  let inside = 0
  for (const [x, y] of stroke.points) {
    if (pointInPolygon(x, y, lasso)) inside++
  }
  // Require roughly half the stroke's points inside, so a stray tail doesn't
  // grab a whole long stroke.
  return inside >= Math.max(1, Math.ceil(stroke.points.length * 0.5))
}
