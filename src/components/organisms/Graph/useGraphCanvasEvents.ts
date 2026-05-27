import { useEffect, type RefObject } from 'react'
import type { GNode, RightClickTarget } from '../../../types'

interface UseGraphCanvasEventsOptions {
  canvasWrapRef: RefObject<HTMLDivElement | null>
  hoveredIdRef: RefObject<string | null>
  dims: { w: number; h: number } | null
  nodes: GNode[]
  findNodeAt: (x: number, y: number) => GNode | null
  onNodeClick: (node: GNode, modifierKey: boolean) => void
  onSelectNone: () => void
  onRightClickNode: (target: RightClickTarget) => void
}

export function useGraphCanvasEvents({
  canvasWrapRef, hoveredIdRef, dims, nodes,
  findNodeAt, onNodeClick, onSelectNone, onRightClickNode,
}: UseGraphCanvasEventsOptions): void {
  useEffect(() => {
    if (!dims || nodes.length === 0) return
    let cleanup: (() => void) | undefined

    const attach = () => {
      const canvas = canvasWrapRef.current?.querySelector('canvas') as HTMLCanvasElement | null
      if (!canvas) return

      let startX = 0; let startY = 0
      const downHandler    = (e: PointerEvent) => { startX = e.offsetX; startY = e.offsetY }
      const clickHandler   = (e: PointerEvent) => {
        if (e.button !== 0) return
        if (Math.hypot(e.offsetX - startX, e.offsetY - startY) > 4) return
        const hit = findNodeAt(e.offsetX, e.offsetY)
        if (hit) { onNodeClick(hit as GNode, e.ctrlKey || e.metaKey); e.stopPropagation() }
        else onSelectNone()
      }
      const contextHandler = (e: MouseEvent) => {
        e.preventDefault()
        const hit = findNodeAt(e.offsetX, e.offsetY)
        if (hit) { onRightClickNode({ node: hit as GNode, x: e.clientX, y: e.clientY }); e.stopPropagation() }
      }
      const moveHandler  = (e: MouseEvent) => {
        const hit = findNodeAt(e.offsetX, e.offsetY)
        hoveredIdRef.current = hit?.id ?? null
        canvas.style.cursor  = hit ? 'pointer' : 'grab'
      }
      const leaveHandler = () => { hoveredIdRef.current = null }

      canvas.addEventListener('pointerdown',  downHandler)
      canvas.addEventListener('pointerup',    clickHandler)
      canvas.addEventListener('contextmenu',  contextHandler)
      canvas.addEventListener('mousemove',    moveHandler)
      canvas.addEventListener('mouseleave',   leaveHandler)
      cleanup = () => {
        canvas.removeEventListener('pointerdown',  downHandler)
        canvas.removeEventListener('pointerup',    clickHandler)
        canvas.removeEventListener('contextmenu',  contextHandler)
        canvas.removeEventListener('mousemove',    moveHandler)
        canvas.removeEventListener('mouseleave',   leaveHandler)
      }
    }

    const t = setTimeout(attach, 80)
    return () => { clearTimeout(t); cleanup?.() }
  }, [dims, nodes, findNodeAt, onNodeClick, onSelectNone, onRightClickNode, canvasWrapRef, hoveredIdRef])
}
