import { useCallback, useEffect, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { RefreshCw } from 'lucide-react'
import type { GNode, GLink } from '../../../types'

type GraphMode = 'links' | 'tags'

interface GraphViewProps {
  nodes: GNode[]
  links: GLink[]
  graphMode: GraphMode
  tagColorMap: Map<string, string>
  selectedNoteId: string | null
  onSelectNote: (noteId: string | null) => void
  onOpenNote: (noteId: string) => void
  rerenderKey: number
  onRelayout: () => void
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return `rgba(251,191,36,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FGRef = any

export function GraphView({
  nodes, links, graphMode, tagColorMap,
  selectedNoteId, onSelectNote, onOpenNote,
  rerenderKey, onRelayout,
}: GraphViewProps): JSX.Element {
  const fgRef         = useRef<FGRef>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const lastClickRef  = useRef<{ id: string; t: number } | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const hoveredIdRef  = useRef<string | null>(null)

  const [dims,      setDims]      = useState<{ w: number; h: number } | null>(null)
  const [bgColor,   setBgColor]   = useState('rgb(10,10,10)')
  const [textColor, setTextColor] = useState('rgba(255,255,255,0.75)')

  // Keep ref in sync for stable callbacks
  useEffect(() => { selectedIdRef.current = selectedNoteId }, [selectedNoteId])

  // Read theme CSS vars
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

  // Measure canvas container
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

  const handleNodeClick = useCallback((node: GNode) => {
    const now = Date.now()
    if (lastClickRef.current?.id === node.id && now - lastClickRef.current.t < 400) {
      onOpenNote(node.id)
      return
    }
    lastClickRef.current = { id: node.id, t: now }
    onSelectNote(selectedIdRef.current === node.id ? null : node.id)
  }, [onSelectNote, onOpenNote])

  // Custom hit-test + hover tracking
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
        const fg = fgRef.current
        if (!fg?.graph2ScreenCoords) return
        const cx = e.offsetX; const cy = e.offsetY
        let closest: GNode | null = null; let minDist = Infinity
        for (const node of nodes) {
          if (node.x == null || node.y == null) continue
          const sc     = fg.graph2ScreenCoords(node.x, node.y)
          const radius = 5 * Math.sqrt(node.val || 1) + 6
          const dist   = Math.hypot(sc.x - cx, sc.y - cy)
          if (dist <= radius && dist < minDist) { minDist = dist; closest = node }
        }
        if (closest) { handleNodeClick(closest as GNode); e.stopPropagation() }
        else onSelectNote(null)
      }
      const moveHandler = (e: MouseEvent) => {
        const fg = fgRef.current
        if (!fg?.graph2ScreenCoords) return
        const cx = e.offsetX; const cy = e.offsetY
        let hitNode: GNode | null = null
        for (const node of nodes) {
          if (node.x == null || node.y == null) continue
          const sc = fg.graph2ScreenCoords(node.x, node.y)
          if (Math.hypot(sc.x - cx, sc.y - cy) <= 5 * Math.sqrt(node.val || 1) + 6) { hitNode = node; break }
        }
        hoveredIdRef.current = hitNode?.id ?? null
        canvas.style.cursor  = hitNode ? 'pointer' : 'grab'
      }
      const leaveHandler = () => { hoveredIdRef.current = null }

      canvas.addEventListener('pointerdown', downHandler)
      canvas.addEventListener('pointerup',   clickHandler)
      canvas.addEventListener('mousemove',   moveHandler)
      canvas.addEventListener('mouseleave',  leaveHandler)
      cleanup = () => {
        canvas.removeEventListener('pointerdown', downHandler)
        canvas.removeEventListener('pointerup',   clickHandler)
        canvas.removeEventListener('mousemove',   moveHandler)
        canvas.removeEventListener('mouseleave',  leaveHandler)
      }
    }

    const t = setTimeout(attach, 80)
    return () => { clearTimeout(t); cleanup?.() }
  }, [dims, nodes, handleNodeClick, onSelectNote])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleNodeHover   = useCallback((_n: GNode | null) => {}, [])
  const handleNodeDragEnd = useCallback((node: GNode) => { node.fx = node.x; node.fy = node.y }, [])

  const nodeCanvasObject = useCallback((node: GNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (hoveredIdRef.current !== node.id) return
    const label    = node.label.length > 22 ? node.label.slice(0, 20) + '…' : node.label
    const fontSize = Math.max(6, 8 / globalScale)
    ctx.font         = `400 ${fontSize}px Manrope, sans-serif`
    ctx.fillStyle    = textColor.replace(/,\s*[\d.]+\)$/, ', 0.55)')
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + 5 * Math.sqrt(node.val || 1) + 2 / globalScale)
  }, [textColor])

  const graphData = { nodes, links }

  return (
    <div className="flex h-full flex-col" style={{ background: bgColor }}>

      {/* Minimal toolbar: just a refresh button */}
      <div className="flex shrink-0 items-center justify-end px-3 py-2"
        style={{ borderBottom: '1px solid rgb(var(--border))', background: 'rgb(var(--surface-2))' }}>
        <button
          title="Re-layout"
          onClick={onRelayout}
          className="rounded-md p-1.5 text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-3))] hover:text-[rgb(var(--text))]"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Canvas */}
      <div ref={canvasWrapRef} className="relative flex-1" style={{ overflow: 'hidden' }}>
        {dims && nodes.length > 0 && (
          <ForceGraph2D
            key={`${rerenderKey}-${dims.w}-${dims.h}-${nodes.length}-${graphMode}`}
            ref={fgRef}
            graphData={graphData}
            backgroundColor={bgColor}
            width={dims.w}
            height={dims.h}
            nodeColor={(node: GNode) => node.id === selectedNoteId ? '#ffffff' : node.color}
            nodeVal={(node: GNode) => node.val}
            nodeLabel={(node: GNode) => node.label}
            nodeRelSize={5}
            nodeCanvasObjectMode={() => 'after'}
            nodeCanvasObject={nodeCanvasObject}
            linkColor={(lnk: GLink) => {
              if (lnk.kind === 'wikilink') return 'rgba(45,212,191,0.4)'
              if (lnk.kind === 'semantic') return 'rgba(129,140,248,0.25)'
              const hex = lnk.sharedTags?.[0] ? tagColorMap.get(lnk.sharedTags[0]) : undefined
              return hex ? hexToRgba(hex, 0.45) : 'rgba(251,191,36,0.4)'
            }}
            linkWidth={(lnk: GLink) => lnk.kind === 'wikilink' ? 1.2 : lnk.kind === 'semantic' ? 0.6 : 1}
            linkDirectionalArrowLength={(l: GLink) => l.kind === 'wikilink' ? 5 : 0}
            linkDirectionalArrowRelPos={1}
            linkDirectionalParticles={(l: GLink) => l.kind === 'wikilink' ? 2 : 0}
            linkDirectionalParticleSpeed={0.004}
            linkDirectionalParticleWidth={1.5}
            linkDirectionalParticleColor={() => '#2dd4bf'}
            d3AlphaDecay={0.035}
            d3VelocityDecay={0.6}
            cooldownTicks={200}
            warmupTicks={60}
            enableNodeDrag
            onNodeHover={handleNodeHover}
            onNodeDragEnd={handleNodeDragEnd}
          />
        )}

        {/* Hint */}
        {nodes.length > 0 && !selectedNoteId && (
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-[11px]"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
            Click node · Double-click to open · Drag to move
          </div>
        )}

        {/* Empty state */}
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
