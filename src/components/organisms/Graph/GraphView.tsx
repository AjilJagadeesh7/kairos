import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

import type { GNode, GLink } from '../../../types'
import { Icon } from '../../../icons/Icon'

// 3D WebGL renderer — loaded lazily so Three.js (~600KB) doesn't enter the
// initial bundle. Only materialises when the user requests the 3D view.
const ForceGraph3D = lazy(() => import('react-force-graph-3d'))

// Survives component unmount/remount (tab switches). Keyed by "mode:nodeId".
const posCache = new Map<string, { x: number; y: number; fx?: number; fy?: number }>()

function savePositions(nodes: GNode[], mode: string) {
  for (const n of nodes) {
    if (n.x != null && n.y != null) {
      posCache.set(`${mode}:${n.id}`, {
        x: n.x, y: n.y,
        fx: n.fx ?? undefined,
        fy: n.fy ?? undefined,
      })
    }
  }
}

function seedPositions(nodes: GNode[], mode: string) {
  for (const n of nodes) {
    // Only seed nodes that d3 hasn't positioned yet (new node objects from a notes update).
    // If x is already set, this is the same live object the simulation is running on —
    // overwriting it would clobber an in-progress drag or a just-pinned position.
    if (n.x != null) continue
    const p = posCache.get(`${mode}:${n.id}`)
    if (p) {
      n.x = p.x; n.y = p.y
      if (p.fx != null) { n.fx = p.fx; n.fy = p.fy }
    }
  }
}

type GraphMode = 'links' | 'tags'

interface RightClickTarget {
  node: GNode
  x: number
  y: number
}

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
  onOpenCanvas: (canvasId: string) => void
  onRightClickNode: (target: RightClickTarget) => void
  rerenderKey: number
  onRelayout: () => void
  onToggleFocus: () => void
  focusMode: boolean
}

export type { RightClickTarget }

function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return `rgba(251,191,36,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FGRef = any

export function GraphView({
  nodes, links, graphMode, tagColorMap,
  selectedNoteId, focusedNodeId, neighborIds,
  onSelectNode, onOpenNote, onOpenCanvas, onRightClickNode,
  rerenderKey, onRelayout, onToggleFocus, focusMode,
}: GraphViewProps): JSX.Element {
  const fgRef         = useRef<FGRef>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const lastClickRef  = useRef<{ id: string; t: number } | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const hoveredIdRef  = useRef<string | null>(null)

  const [dims,      setDims]      = useState<{ w: number; h: number } | null>(null)
  const [bgColor,   setBgColor]   = useState('rgb(10,10,10)')
  const [textColor, setTextColor] = useState('rgba(255,255,255,0.75)')
  // 3D WebGL toggle — auto-on for very large graphs (>300 nodes)
  const [force3D, setForce3D] = useState(false)
  const use3D = force3D || nodes.length > 300

  useEffect(() => { selectedIdRef.current = selectedNoteId }, [selectedNoteId])

  // Clear cache when user explicitly requests a relayout so nodes scatter fresh
  const prevRerenderKey = useRef(rerenderKey)
  useEffect(() => {
    if (rerenderKey !== prevRerenderKey.current) {
      for (const key of posCache.keys()) {
        if (key.startsWith(`${graphMode}:`)) posCache.delete(key)
      }
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
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue
      const sc     = fg.graph2ScreenCoords(node.x, node.y)
      const radius = 5 * Math.sqrt(node.val || 1) + 6
      const dist   = Math.hypot(sc.x - offsetX, sc.y - offsetY)
      if (dist <= radius && dist < minDist) { minDist = dist; closest = node }
    }
    return closest
  }, [nodes])

  const handleNodeClick = useCallback((node: GNode) => {
    const now = Date.now()
    if (lastClickRef.current?.id === node.id && now - lastClickRef.current.t < 400) {
      if (node.nodeType === 'note') onOpenNote(node.id)
      else if (node.nodeType === 'canvas' && node.canvasId) onOpenCanvas(node.canvasId)
      return
    }
    lastClickRef.current = { id: node.id, t: now }
    onSelectNode(selectedIdRef.current === node.id ? null : node.id)
  }, [onSelectNode, onOpenNote, onOpenCanvas])

  useEffect(() => {
    if (!dims || nodes.length === 0) return
    let cleanup: (() => void) | undefined

    const attach = () => {
      const canvas = canvasWrapRef.current?.querySelector('canvas') as HTMLCanvasElement | null
      if (!canvas) return

      let startX = 0; let startY = 0
      const downHandler  = (e: PointerEvent) => { startX = e.offsetX; startY = e.offsetY }
      const clickHandler = (e: PointerEvent) => {
        if (e.button !== 0) return
        if (Math.hypot(e.offsetX - startX, e.offsetY - startY) > 4) return
        const closest = findNodeAt(e.offsetX, e.offsetY)
        if (closest) { handleNodeClick(closest as GNode); e.stopPropagation() }
        else onSelectNode(null)
      }
      const contextHandler = (e: MouseEvent) => {
        e.preventDefault()
        const closest = findNodeAt(e.offsetX, e.offsetY)
        if (closest) {
          onRightClickNode({ node: closest as GNode, x: e.clientX, y: e.clientY })
          e.stopPropagation()
        }
      }
      const moveHandler = (e: MouseEvent) => {
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
  }, [dims, nodes, findNodeAt, handleNodeClick, onSelectNode, onRightClickNode])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleNodeHover   = useCallback((_n: GNode | null) => {}, [])
  const handleNodeDragEnd = useCallback((node: GNode) => {
    node.fx = node.x
    node.fy = node.y
    // Write to posCache immediately — don't wait for handleEngineStop.
    // If notes update and the graph remounts before the simulation decays,
    // seedPositions will still restore the pinned position.
    if (node.x != null && node.y != null) {
      posCache.set(`${graphMode}:${node.id}`, { x: node.x, y: node.y, fx: node.x, fy: node.y })
    }
  }, [graphMode])

  const isFocused = focusMode && focusedNodeId !== null
  const isLargeGraph = nodes.length > 200

  // Degree map for LOD label suppression on large graphs
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

  const nodeCanvasObject = useCallback((node: GNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected  = node.id === selectedNoteId
    const isHovered   = hoveredIdRef.current === node.id
    const isDimmed    = isFocused && !neighborIds.has(node.id) && node.id !== focusedNodeId
    const deg         = degreeMap.get(node.id) ?? 0
    // On large graphs, suppress labels for low-degree nodes unless selected/hovered
    const suppressLabel = isLargeGraph && deg < 3 && !isSelected && !isHovered

    const r      = 5 * Math.sqrt(node.val || 1)
    const alpha  = isDimmed ? 0.12 : 1

    ctx.globalAlpha = alpha

    if (node.nodeType === 'task') {
      // Rounded rectangle for tasks
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
      // Diamond shape for canvases
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

      // Always show canvas label
      const label    = node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label
      const fontSize = Math.max(6, 8 / globalScale)
      ctx.font         = `600 ${fontSize}px Manrope, sans-serif`
      ctx.fillStyle    = isDimmed ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.9)'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + hw + 3 / globalScale)
    }

    // Note/task labels — hidden for low-degree nodes on large graphs
    if (node.nodeType !== 'canvas' && !isDimmed && !suppressLabel) {
      const label    = node.label.length > 22 ? node.label.slice(0, 20) + '…' : node.label
      const fontSize = Math.max(6, 8 / globalScale)
      ctx.font         = `400 ${fontSize}px Manrope, sans-serif`
      ctx.fillStyle    = isSelected || isHovered
        ? 'rgba(255,255,255,0.9)'
        : textColor.replace(/,\s*[\d.]+\)$/, ', 0.55)')
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + r + 2 / globalScale)
    }

    ctx.globalAlpha = 1
  }, [selectedNoteId, isFocused, neighborIds, focusedNodeId, textColor, degreeMap, isLargeGraph])

  // Whether all nodes already have cached positions from a previous visit.
  // Stored in a ref so the graphData useMemo can set it and the JSX can read it
  // without an extra state re-render.
  const allPrePositionedRef = useRef(false)

  // Seed cached positions so nodes don't scatter on remount (tab switch).
  // Also detect whether every node already has a cached position — if so we
  // can skip running the force simulation entirely on this visit.
  const graphData = useMemo(() => {
    allPrePositionedRef.current =
      nodes.length > 0 && nodes.every(n => posCache.has(`${graphMode}:${n.id}`))
    seedPositions(nodes, graphMode)
    return { nodes, links }
  }, [nodes, links, graphMode])

  // Debounce graphData changes by 150 ms so that the initial wikilink graph and
  // the semantic-link update (which arrives ~50–100 ms later via the cached
  // similarity worker) are coalesced into a single ForceGraph2D initialisation.
  // Without this, the simulation restarts twice on every visit.
  const [committedData, setCommittedData] = useState<typeof graphData | null>(null)
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestDataRef  = useRef(graphData)
  latestDataRef.current = graphData

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      setCommittedData(latestDataRef.current)
    }, 150)
  }, [graphData])

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // Save positions on unmount (tab switch away) and periodically via onEngineStop
  useEffect(() => {
    return () => { savePositions(nodes, graphMode) }
  }, [nodes, graphMode])

  const handleEngineStop = useCallback(() => {
    savePositions(nodes, graphMode)
  }, [nodes, graphMode])

  return (
    <div className="flex h-full flex-col" style={{ background: bgColor }}>
      <div className="flex shrink-0 items-center justify-end gap-1 px-3 py-2"
        style={{ borderBottom: '1px solid rgb(var(--border))', background: 'rgb(var(--surface-2))' }}>
        <button
          title={focusMode ? 'Exit focus mode' : 'Focus on selected node'}
          onClick={onToggleFocus}
          disabled={!selectedNoteId}
          className={`rounded-md p-1.5 transition ${
            focusMode
              ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]'
              : 'text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-3))] hover:text-[rgb(var(--text))] disabled:opacity-30'
          }`}
        >
          <Icon name="crosshair" size={13} />
        </button>
        <button
          title="Re-layout"
          onClick={onRelayout}
          className="rounded-md p-1.5 text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-3))] hover:text-[rgb(var(--text))]"
        >
          <Icon name="refresh-cw" size={13} />
        </button>
        <button
          title={use3D ? 'Switch to 2D canvas' : 'Switch to 3D WebGL (faster for large graphs)'}
          onClick={() => setForce3D(v => !v)}
          className={`rounded-md p-1.5 transition text-xs font-semibold ${
            use3D
              ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]'
              : 'text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-3))] hover:text-[rgb(var(--text))]'
          }`}
        >
          {use3D ? '2D' : '3D'}
        </button>
      </div>

      <div ref={canvasWrapRef} className="relative flex-1" style={{ overflow: 'hidden' }}>
        {dims && nodes.length > 0 && use3D && (
          <Suspense fallback={
            <div className="flex h-full items-center justify-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <Icon name="loader-2" size={20} className="animate-spin" />
            </div>
          }>
            <ForceGraph3D
              key={`3d-${rerenderKey}`}
              graphData={graphData}
              backgroundColor={bgColor}
              width={dims.w}
              height={dims.h}
              nodeColor={(node: GNode) => node.id === selectedNoteId ? '#ffffff' : node.color}
              nodeVal={(node: GNode) => node.val}
              nodeLabel={(node: GNode) => node.label}
              linkColor={(lnk: GLink) => {
                if (lnk.kind === 'wikilink')   return 'rgba(45,212,191,0.5)'
                if (lnk.kind === 'semantic')   return 'rgba(129,140,248,0.3)'
                if (lnk.kind === 'task-note')  return 'rgba(251,146,60,0.6)'
                return 'rgba(251,191,36,0.4)'
              }}
              linkWidth={1}
              onNodeClick={(node: GNode) => handleNodeClick(node)}
              d3AlphaDecay={0.04}
              d3VelocityDecay={0.4}
              cooldownTicks={100}
            />
          </Suspense>
        )}
        {dims && committedData && committedData.nodes.length > 0 && !use3D && (
          <ForceGraph2D
            key={`${rerenderKey}-${graphMode}`}
            ref={fgRef}
            graphData={committedData}
            backgroundColor={bgColor}
            width={dims.w}
            height={dims.h}
            nodeColor={(node: GNode) => {
              if (node.nodeType === 'task' || node.nodeType === 'canvas') return 'transparent'
              const isDimmed = isFocused && !neighborIds.has(node.id) && node.id !== focusedNodeId
              if (isDimmed) return node.id === selectedNoteId ? '#ffffff22' : node.color + '1f'
              return node.id === selectedNoteId ? '#ffffff' : node.color
            }}
            nodeVal={(node: GNode) => node.val}
            nodeLabel={() => ''}
            nodeRelSize={5}
            nodeCanvasObjectMode={() => 'after'}
            nodeCanvasObject={nodeCanvasObject}
            linkColor={(lnk: GLink) => {
              const isDimmedLink = isFocused && (() => {
                const src = typeof lnk.source === 'object' ? lnk.source.id : lnk.source
                const tgt = typeof lnk.target === 'object' ? lnk.target.id : lnk.target
                return !neighborIds.has(src) || !neighborIds.has(tgt)
              })()
              const baseAlpha = isDimmedLink ? 0.06 : undefined
              if (lnk.kind === 'wikilink')   return `rgba(45,212,191,${baseAlpha ?? 0.4})`
              if (lnk.kind === 'semantic')   return `rgba(129,140,248,${baseAlpha ?? 0.25})`
              if (lnk.kind === 'task-note')  return `rgba(251,146,60,${baseAlpha ?? 0.5})`
              if (lnk.kind === 'task-task')  return `rgba(192,132,252,${baseAlpha ?? 0.4})`
              if (lnk.kind === 'canvas')      return `rgba(34,197,94,${baseAlpha ?? 0.5})`
              if (lnk.kind === 'canvas-note') return `rgba(245,158,11,${baseAlpha ?? 0.4})`
              const hex = lnk.sharedTags?.[0] ? tagColorMap.get(lnk.sharedTags[0]) : undefined
              return hex ? hexToRgba(hex, baseAlpha ?? 0.45) : `rgba(251,191,36,${baseAlpha ?? 0.4})`
            }}
            linkWidth={(lnk: GLink) =>
              lnk.kind === 'wikilink' ? 1.2 :
              lnk.kind === 'semantic' ? 0.6 :
              lnk.kind === 'task-note' || lnk.kind === 'task-task' ? 1 : 1
            }
            linkDirectionalArrowLength={(l: GLink) =>
              l.kind === 'wikilink' || l.kind === 'task-note' ? 5 : 0
            }
            linkDirectionalArrowRelPos={1}
            d3AlphaDecay={isLargeGraph ? 0.06 : 0.035}
            d3VelocityDecay={isLargeGraph ? 0.7 : 0.6}
            cooldownTicks={allPrePositionedRef.current ? 0 : (isLargeGraph ? 80 : 200)}
            warmupTicks={0}
            enableNodeDrag
            onNodeHover={handleNodeHover}
            onNodeDragEnd={handleNodeDragEnd}
            onEngineStop={handleEngineStop}
          />
        )}

        {/* Settling spinner: shown for the ~150ms debounce window before ForceGraph2D mounts */}
        {dims && nodes.length > 0 && !committedData && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Icon name="loader-2" size={22} className="animate-spin" style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
        )}

        {committedData && committedData.nodes.length > 0 && !selectedNoteId && (
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
