import type { GNode } from '../types'

// Survives component unmount/remount (tab switches). Keyed by "mode:nodeId".
// Only x/y are persisted — fx/fy are intentionally excluded so all nodes
// enter each visit unpinned and the simulation animates them consistently.
const posCache = new Map<string, { x: number; y: number }>()

export function savePositions(nodes: GNode[], mode: string) {
  for (const n of nodes) {
    if (n.x != null && n.y != null) posCache.set(`${mode}:${n.id}`, { x: n.x, y: n.y })
  }
}

export function seedPositions(nodes: GNode[], mode: string) {
  for (const n of nodes) {
    const p = posCache.get(`${mode}:${n.id}`)
    if (p) { n.x = p.x; n.y = p.y }
  }
}

export function clearPositionsForMode(mode: string) {
  for (const key of posCache.keys()) {
    if (key.startsWith(`${mode}:`)) posCache.delete(key)
  }
}

export function hasCachedPositions(nodes: GNode[], mode: string): boolean {
  return nodes.some(n => posCache.has(`${mode}:${n.id}`))
}
