import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { GNode, GLink, GraphMode, RightClickTarget } from '../../../types'
import { Icon } from '../../../icons/Icon'
import { hexToRgba } from './graphCanvasUtils'
import { savePositions, seedPositions, clearPositionsForMode, hasCachedPositions } from '../../../hooks/useGraphPositionCache'
import { GraphViewToolbar } from './GraphViewToolbar'
import { makeNodeRenderer } from './graphNodeRenderer'
import { useGraphCanvasEvents } from './useGraphCanvasEvents'

export type { RightClickTarget }

const ForceGraph3D = lazy(() => import('react-force-graph-3d'))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FGRef = any

interface GraphViewProps {
  nodes: GNode[]
  links: GLink[]
  graphMode: GraphMode
  tagColorMap: Map<string, string>
  selectedNoteId: string | null
  focusedNodeId: string | null
  neighborIds: Set<string>
  onSelectNode: (nodeId: string | null) => void
  onOpenNote: (noteId: string) => void
  onOpenNoteInNewPane?: (noteId: string) => void
  onOpenCanvas: (canvasId: string) => void
  onRightClickNode: (target: RightClickTarget) => void
  rerenderKey: number
  onRelayout: () => void
  onToggleFocus: () => void
  focusMode: boolean
}

export function GraphView({
  nodes, links, graphMode, tagColorMap,
  selectedNoteId, focusedNodeId, neighborIds,
  onSelectNode, onOpenNote, onOpenNoteInNewPane, onOpenCanvas, onRightClickNode,
  rerenderKey, onRelayout, onToggleFocus, focusMode,
}: GraphViewProps): JSX.Element {
  const fgRef         = useRef<FGRef>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const lastClickRef  = useRef<{ id: string; t: number } | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const hoveredIdRef  = useRef<string | null>(null)
  const activeNodesRef = useRef<GNode[]>(nodes)

  const [dims,      setDims]      = useState<{ w: number; h: number } | null>(null)
  const [bgColor,   setBgColor]   = useState('rgb(10,10,10)')
  const [textColor, setTextColor] = useState('rgba(255,255,255,0.75)')
  const [force3D,   setForce3D]   = useState(false)
  const use3D = force3D || nodes.length > 300

  useEffect(() => { selectedIdRef.current = selectedNoteId }, [selectedNoteId])

  const prevRerenderKey = useRef(rerenderKey)
  useEffect(() => {
    if (rerenderKey !== prevRerenderKey.current) {
      clearPositionsForMode(graphMode)
      prevRerenderKey.current = rerenderKey
    }
  }, [rerenderKey, graphMode])

  useEffect(() => {
    const readTheme = () => {
      const style = getComputedStyle(document.documentElement)
      const bg  = style.getPropertyValue('--bg').trim().split(/\s+/).map(Number)
      const txt = style.getPropertyValue('--text').trim().split(/\s+/).map(Number)
      if (bg.length  === 3) setBgColor(`rgb(${bg.join(',')})`)
      if (txt.length === 3) setTextColor(`rgba(${txt[0]},${txt[1]},${txt[2]},0.8)`)
    }
    readTheme()
    const obs = new MutationObserver(readTheme)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDims({ w: Math.round(width), h: Math.round(height) })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const findNodeAt = useCallback((offsetX: number, offsetY: number): GNode | null => {
    const fg = fgRef.current
    if (!fg?.graph2ScreenCoords) return null
    let closest: GNode | null = null; let minDist = Infinity
    for (const node of activeNodesRef.current) {
      if (node.x == null || node.y == null) continue
      const sc     = fg.graph2ScreenCoords(node.x, node.y)
      const radius = 5 * Math.sqrt(node.val || 1) + 6
      const dist   = Math.hypot(sc.x - offsetX, sc.y - offsetY)
      if (dist <= radius && dist < minDist) { minDist = dist; closest = node }
    }
    return closest
  }, [])

  const handleNodeClick = useCallback((node: GNode, modifierKey = false) => {
    if (modifierKey && node.nodeType === 'note' && onOpenNoteInNewPane) {
      onOpenNoteInNewPane(node.id); return
    }
    const now = Date.now()
    if (lastClickRef.current?.id === node.id && now - lastClickRef.current.t < 400) {
      if (node.nodeType === 'note') onOpenNote(node.id)
      else if (node.nodeType === 'canvas' && node.canvasId) onOpenCanvas(node.canvasId)
      return
    }
    lastClickRef.current = { id: node.id, t: now }
    onSelectNode(selectedIdRef.current === node.id ? null : node.id)
  }, [onSelectNode, onOpenNote, onOpenNoteInNewPane, onOpenCanvas])

  useGraphCanvasEvents({
    canvasWrapRef, hoveredIdRef, dims, nodes,
    findNodeAt, onNodeClick: handleNodeClick,
    onSelectNone: () => onSelectNode(null),
    onRightClickNode,
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleNodeHover   = useCallback((_n: GNode | null) => {}, [])
  const handleNodeDragEnd = useCallback((node: GNode) => {
    node.fx = node.x; node.fy = node.y
  }, [])

  const isLargeGraph = nodes.length > 200
  const degreeMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of links) {
      const s = typeof l.source === 'object' ? l.source.id : l.source
      const t = typeof l.target === 'object' ? l.target.id : l.target
      m.set(s, (m.get(s) ?? 0) + 1)
      m.set(t, (m.get(t) ?? 0) + 1)
    }
    return m
  }, [links])

  const nodeCanvasObject = useCallback(
    makeNodeRenderer({ selectedNoteId, focusedNodeId, neighborIds, focusMode, textColor, degreeMap, isLargeGraph, hoveredIdRef }),
    [selectedNoteId, focusedNodeId, neighborIds, focusMode, textColor, degreeMap, isLargeGraph], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const graphData = useMemo(() => {
    const nodesCopy = nodes.map(n => ({ ...n }))
    seedPositions(nodesCopy, graphMode)
    activeNodesRef.current = nodesCopy
    const nodeIdSet = new Set(nodesCopy.map(n => n.id))
    const safeLinks = links.filter(l => {
      const src = typeof l.source === 'object' ? (l.source as GNode).id : l.source
      const tgt = typeof l.target === 'object' ? (l.target as GNode).id : l.target
      return nodeIdSet.has(src as string) && nodeIdSet.has(tgt as string)
    })
    return { nodes: nodesCopy, links: safeLinks }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rerenderKey, nodes.length, links.length, graphMode])

  useEffect(() => () => { savePositions(activeNodesRef.current, graphMode) }, [graphMode])
  useEffect(() => () => { fgRef.current?.pauseAnimation() }, [])

  const handleEngineStop = useCallback(() => {
    savePositions(activeNodesRef.current, graphMode)
  }, [graphMode])

  const linkColor = useCallback((lnk: GLink) => {
    const isFocused = focusMode && focusedNodeId !== null
    const isDimmedLink = isFocused && (() => {
      const src = typeof lnk.source === 'object' ? lnk.source.id : lnk.source
      const tgt = typeof lnk.target === 'object' ? lnk.target.id : lnk.target
      return !neighborIds.has(src) || !neighborIds.has(tgt)
    })()
    const a = isDimmedLink ? 0.06 : undefined
    if (lnk.kind === 'wikilink')    return `rgba(45,212,191,${a ?? 0.4})`
    if (lnk.kind === 'semantic')    return `rgba(129,140,248,${a ?? 0.25})`
    if (lnk.kind === 'task-note')   return `rgba(251,146,60,${a ?? 0.5})`
    if (lnk.kind === 'task-task')   return `rgba(192,132,252,${a ?? 0.4})`
    if (lnk.kind === 'canvas')      return `rgba(34,197,94,${a ?? 0.5})`
    if (lnk.kind === 'canvas-note') return `rgba(245,158,11,${a ?? 0.4})`
    const hex = lnk.sharedTags?.[0] ? tagColorMap.get(lnk.sharedTags[0]) : undefined
    return hex ? hexToRgba(hex, a ?? 0.45) : `rgba(251,191,36,${a ?? 0.4})`
  }, [focusMode, focusedNodeId, neighborIds, tagColorMap])

  return (
    <div className="flex h-full flex-col" style={{ background: bgColor }}>
      <GraphViewToolbar
        focusMode={focusMode}
        selectedNoteId={selectedNoteId}
        use3D={use3D}
        onToggleFocus={onToggleFocus}
        onRelayout={onRelayout}
        onToggle3D={() => setForce3D(v => !v)}
      />

      <div ref={canvasWrapRef} className="relative flex-1" style={{ overflow: 'hidden' }}>
        {dims && nodes.length > 0 && use3D && (
          <Suspense fallback={
            <div className="flex h-full items-center justify-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <Icon name="loader-2" size={20} className="animate-spin" />
            </div>
          }>
            <ForceGraph3D
              key={`3d-${rerenderKey}-${nodes.length}`}
              graphData={graphData} backgroundColor={bgColor} width={dims.w} height={dims.h}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nodeColor={(node: any) => (node as GNode).id === selectedNoteId ? '#ffffff' : (node as GNode).color}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nodeVal={(node: any) => (node as GNode).val}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nodeLabel={(node: any) => (node as GNode).label}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkColor={(lnk: any) => {
                const l = lnk as GLink
                if (l.kind === 'wikilink')  return 'rgba(45,212,191,0.5)'
                if (l.kind === 'semantic')  return 'rgba(129,140,248,0.3)'
                if (l.kind === 'task-note') return 'rgba(251,146,60,0.6)'
                return 'rgba(251,191,36,0.4)'
              }}
              linkWidth={1}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onNodeClick={(node: any) => handleNodeClick(node as GNode)}
              d3AlphaDecay={0.04} d3VelocityDecay={0.4} cooldownTicks={100}
            />
          </Suspense>
        )}
        {dims && nodes.length > 0 && !use3D && (
          <ForceGraph2D
            key={`${rerenderKey}-${graphMode}-${nodes.length}`}
            ref={fgRef}
            graphData={graphData} backgroundColor={bgColor} width={dims.w} height={dims.h}
            nodeColor={(node: GNode) => {
              if (node.nodeType === 'task' || node.nodeType === 'canvas') return 'transparent'
              const isFocused = focusMode && focusedNodeId !== null
              const isDimmed = isFocused && !neighborIds.has(node.id) && node.id !== focusedNodeId
              if (isDimmed) return node.id === selectedNoteId ? '#ffffff22' : node.color + '1f'
              return node.id === selectedNoteId ? '#ffffff' : node.color
            }}
            nodeVal={(node: GNode) => node.val}
            nodeLabel={() => ''}
            nodeRelSize={5}
            nodeCanvasObjectMode={() => 'after'}
            nodeCanvasObject={nodeCanvasObject}
            linkColor={linkColor}
            linkWidth={(lnk: GLink) => lnk.kind === 'wikilink' ? 1.2 : lnk.kind === 'semantic' ? 0.6 : 1}
            linkDirectionalArrowLength={(l: GLink) => l.kind === 'wikilink' || l.kind === 'task-note' ? 5 : 0}
            linkDirectionalArrowRelPos={1}
            d3AlphaDecay={isLargeGraph ? 0.06 : 0.035}
            d3VelocityDecay={isLargeGraph ? 0.7 : 0.6}
            cooldownTicks={isLargeGraph ? 80 : 200}
            warmupTicks={hasCachedPositions(nodes, graphMode) ? 0 : 60}
            enableNodeDrag
            onNodeHover={handleNodeHover}
            onNodeDragEnd={handleNodeDragEnd}
            onEngineStop={handleEngineStop}
          />
        )}

        {nodes.length > 0 && !selectedNoteId && (
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-[11px]"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
            Click · Double-click to open · Right-click for options
          </div>
        )}
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm"
            style={{ color: 'rgba(255,255,255,0.25)' }}>
            {graphMode === 'tags'
              ? 'Add tags to notes to see tag connections.'
              : 'No notes yet. Create some notes to see the graph.'}
          </div>
        )}
      </div>
    </div>
  )
}
