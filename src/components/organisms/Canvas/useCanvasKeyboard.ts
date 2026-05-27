import { useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { Node, Edge } from '@xyflow/react'

interface Options {
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: (fn: (ns: Node[]) => Node[]) => void
  scheduleSave: () => void
  undo: (current: { nodes: Node[]; edges: Edge[] }) => { nodes: Node[]; edges: Edge[] } | null
  redo: (current: { nodes: Node[]; edges: Edge[] }) => { nodes: Node[]; edges: Edge[] } | null
  onUndoApply: (snap: { nodes: Node[]; edges: Edge[] }) => void
  onRedoApply: (snap: { nodes: Node[]; edges: Edge[] }) => void
  pushHistory: (snap: { nodes: Node[]; edges: Edge[] }) => void
}

export function useCanvasKeyboard({
  nodesRef, edgesRef, setNodes, scheduleSave,
  undo, redo, onUndoApply, onRedoApply, pushHistory,
}: Options) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        const p = undo({ nodes: nodesRef.current, edges: edgesRef.current })
        if (p) { onUndoApply(p); scheduleSave() }
      } else if (mod && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault()
        const n = redo({ nodes: nodesRef.current, edges: edgesRef.current })
        if (n) { onRedoApply(n); scheduleSave() }
      } else if (mod && e.key === 'd') {
        e.preventDefault()
        const sel = nodesRef.current.filter(n => n.selected)
        if (!sel.length) return
        pushHistory({ nodes: nodesRef.current, edges: edgesRef.current })
        setNodes(ns => [...ns, ...sel.map(n => ({
          ...n, id: crypto.randomUUID(),
          position: { x: n.position.x + 30, y: n.position.y + 30 },
          selected: false,
        }))])
        scheduleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
