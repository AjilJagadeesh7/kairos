import { roundRect } from './graphCanvasUtils'
import type { GNode } from '../../../types'

interface NodeRendererOptions {
  selectedNoteId: string | null
  focusedNodeId: string | null
  neighborIds: Set<string>
  focusMode: boolean
  textColor: string
  accentColor: string
  degreeMap: Map<string, number>
  isLargeGraph: boolean
  hoveredIdRef: React.RefObject<string>
}

export function makeNodeRenderer(opts: NodeRendererOptions) {
  const { selectedNoteId, focusedNodeId, neighborIds, focusMode, textColor, accentColor, degreeMap, isLargeGraph, hoveredIdRef } = opts

  // A selection is active whenever a node is selected — highlight its neighbours
  // and dim the rest, even without focus mode. Focus mode dims more aggressively.
  const selectionActive = focusedNodeId !== null

  return (node: GNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected  = node.id === selectedNoteId
    const isHovered   = hoveredIdRef.current === node.id
    const isNeighbor  = neighborIds.has(node.id)
    const isDimmed    = selectionActive && !isNeighbor
    const deg         = degreeMap.get(node.id) ?? 0
    const suppressLabel = isLargeGraph && deg < 3 && !isSelected && !isHovered

    const r     = 5 * Math.sqrt(node.val || 1)
    const alpha = isDimmed ? (focusMode ? 0.08 : 0.22) : 1
    ctx.globalAlpha = alpha

    if (node.nodeType === 'task') {
      const hw = r * 1.6; const hh = r * 0.9
      ctx.fillStyle = node.color + 'cc'
      roundRect(ctx, (node.x ?? 0) - hw, (node.y ?? 0) - hh, hw * 2, hh * 2, 3)
      ctx.fill()
      if (isSelected) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth   = 1.5 / globalScale
        ctx.stroke()
      }
    }

    if (node.nodeType === 'canvas') {
      const hw = r * 1.5
      ctx.fillStyle   = node.color + 'cc'
      ctx.strokeStyle = isSelected ? '#ffffff' : node.color
      ctx.lineWidth   = isSelected ? 2 / globalScale : 1 / globalScale
      ctx.beginPath()
      ctx.moveTo(node.x ?? 0,        (node.y ?? 0) - hw)
      ctx.lineTo((node.x ?? 0) + hw, node.y ?? 0)
      ctx.lineTo(node.x ?? 0,        (node.y ?? 0) + hw)
      ctx.lineTo((node.x ?? 0) - hw, node.y ?? 0)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      const label    = node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label
      const fontSize = Math.max(6, 8 / globalScale)
      ctx.font         = `600 ${fontSize}px Manrope, sans-serif`
      ctx.fillStyle    = isDimmed ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.9)'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + hw + 3 / globalScale)
    }

    // Accent ring on the selected node's direct neighbours, so the connected
    // set reads clearly when a node is picked.
    if (selectionActive && isNeighbor && !isSelected && node.nodeType === 'note') {
      ctx.globalAlpha = 1
      ctx.strokeStyle = accentColor
      ctx.lineWidth   = 1.6 / globalScale
      ctx.beginPath()
      ctx.arc(node.x ?? 0, node.y ?? 0, r + 2 / globalScale, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = alpha
    }

    if (node.nodeType !== 'canvas' && !isDimmed && !suppressLabel) {
      const label    = node.label.length > 22 ? node.label.slice(0, 20) + '…' : node.label
      const fontSize = Math.max(6, 8 / globalScale)
      ctx.font         = `400 ${fontSize}px Manrope, sans-serif`
      ctx.fillStyle    = isSelected || isHovered
        ? 'rgba(255,255,255,0.9)'
        : textColor.replace(/,\s*[\d.]+\)$/, selectionActive && isNeighbor ? ', 0.8)' : ', 0.55)')
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + r + 2 / globalScale)
    }

    ctx.globalAlpha = 1
  }
}
