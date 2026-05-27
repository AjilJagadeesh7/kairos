import type { Node } from '@xyflow/react'
import type { CanvasNode, CanvasEdge } from '../../../types'

export function toFlowNodes(nodes: CanvasNode[]): Node[] {
  return nodes.map(n => ({
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
