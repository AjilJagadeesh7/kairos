import { useCallback, useReducer, useRef } from 'react'
import type { Node, Edge } from '@xyflow/react'

interface Snapshot { nodes: Node[]; edges: Edge[] }

export function useCanvasHistory() {
  const past   = useRef<Snapshot[]>([])
  const future = useRef<Snapshot[]>([])
  const [, bump] = useReducer((x: number) => x + 1, 0)

  const push = useCallback((snap: Snapshot) => {
    past.current   = [...past.current.slice(-49), { nodes: [...snap.nodes], edges: [...snap.edges] }]
    future.current = []
    bump()
  }, [bump])

  const undo = useCallback((current: Snapshot): Snapshot | null => {
    if (!past.current.length) return null
    const prev = past.current[past.current.length - 1]
    past.current   = past.current.slice(0, -1)
    future.current = [{ nodes: [...current.nodes], edges: [...current.edges] }, ...future.current.slice(0, 49)]
    bump()
    return { nodes: [...prev.nodes], edges: [...prev.edges] }
  }, [bump])

  const redo = useCallback((current: Snapshot): Snapshot | null => {
    if (!future.current.length) return null
    const next = future.current[0]
    future.current = future.current.slice(1)
    past.current   = [...past.current.slice(-49), { nodes: [...current.nodes], edges: [...current.edges] }]
    bump()
    return { nodes: [...next.nodes], edges: [...next.edges] }
  }, [bump])

  return {
    push, undo, redo,
    get canUndo() { return past.current.length > 0 },
    get canRedo() { return future.current.length > 0 },
  }
}
