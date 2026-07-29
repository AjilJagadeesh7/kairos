import type { Node } from '@xyflow/react'
import type { CanvasNode, CanvasEdge } from '../../../types'

/**
 * Canvases saved before the web node was removed still carry `type: 'web'`
 * nodes. Nothing renders them any more, so degrade each to a text node holding
 * the page title and URL rather than handing React Flow an unknown type. The
 * rewrite sticks on the canvas's next save.
 */
function migrateLegacyNode(n: CanvasNode): CanvasNode {
  if ((n.type as string) !== 'web') return n
  const { url, title } = n.data as { url?: string; title?: string }
  return { ...n, type: 'text', data: { text: [title, url].filter(Boolean).join('\n') } }
}

export function toFlowNodes(nodes: CanvasNode[]): Node[] {
  return nodes.map(migrateLegacyNode).map(n => ({
    id:         n.id,
    type:       n.type,
    position:   n.position,
    data:       { ...n.data } as Record<string, unknown>,
    width:      n.width,
    height:     n.height,
    dragHandle: '.drag-handle',
  }))
}

export function toCanvasNode(n: Node): CanvasNode {
  const { canvasId: _a, onDelete: _b, onOpenNote: _c, onDataChange: _d, ...safeData } = n.data as Record<string, unknown>
  return {
    id:       n.id,
    type:     n.type as CanvasNode['type'],
    position: n.position,
    data:     safeData as CanvasNode['data'],
    width:    n.measured?.width ?? n.width,
    height:   n.measured?.height ?? n.height,
  }
}

export function toCanvasEdge(e: { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null; label?: unknown; animated?: boolean }): CanvasEdge {
  return {
    id:           e.id,
    source:       e.source,
    target:       e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label:        typeof e.label === 'string' ? e.label : undefined,
    animated:     e.animated,
  }
}
